import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Get user role from profile
  let userRole = null
  if (user) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      userRole = profile?.role
      console.log('User role from middleware:', userRole) // Debug log
    } catch (error) {
      console.error('Error fetching profile in middleware:', error)
    }
  }

  const path = request.nextUrl.pathname

  // Public routes
  const publicRoutes = ['/login', '/tracking']
  const isPublicRoute = publicRoutes.some(route => path.startsWith(route))

  // Redirect to login if not authenticated
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect to dashboard if already logged in and trying to access login
  if (user && path === '/login') {
    // Default to admin if role not found
    const redirectPath = userRole ? `/${userRole}` : '/admin'
    return NextResponse.redirect(new URL(redirectPath, request.url))
  }

  // Role-based route protection (only if role exists)
  if (user && userRole && path !== '/login' && path !== '/') {
    const roleRoutes: Record<string, string[]> = {
      admin: ['/admin'],
      teknisi: ['/teknisi'],
      supervisor: ['/qc'],
      owner: ['/owner'],
    }

    const allowedPaths = roleRoutes[userRole] || []
    const isAllowed = allowedPaths.some(allowedPath => path.startsWith(allowedPath))

    if (!isAllowed && !isPublicRoute) {
      return NextResponse.redirect(new URL(`/${userRole}`, request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|uploads).*)'],
}
