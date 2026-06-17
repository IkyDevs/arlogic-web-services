'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, UserRole } from '@/types'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Edit2, Save, X, UserPlus, Search, Filter,
  ChevronDown, ChevronUp, Trash2, Users,
  Shield, UserCheck, UserX, Clock, Mail,
  Activity, MoreVertical, Copy, Check
} from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'

export default function RoleManagement() {
  const [users, setUsers] = useState<Profile[]>([])
  const [filteredUsers, setFilteredUsers] = useState<Profile[]>([])
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<UserRole>('customer')
  const [showAddUser, setShowAddUser] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<'full_name' | 'email' | 'role'>('full_name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [loading, setLoading] = useState(true)
  const [newUser, setNewUser] = useState({
    email: '',
    full_name: '',
    role: 'customer' as UserRole,
    password: '',
  })
  const [deletingUser, setDeletingUser] = useState<Profile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showRoleStats, setShowRoleStats] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const supabase = createClient()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)')

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    filterAndSortUsers()
  }, [users, searchQuery, sortField, sortDirection])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Failed to fetch users')
    } else {
      setUsers(data || [])
    }
    setLoading(false)
  }, [])

  const filterAndSortUsers = useCallback(() => {
    let filtered = [...users]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (user) =>
          user.full_name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          user.role.toLowerCase().includes(query)
      )
    }

    filtered.sort((a, b) => {
      let aVal: any = a[sortField]
      let bVal: any = b[sortField]

      if (sortField === 'role') {
        const roleOrder: Record<string, number> = {
          admin: 0,
          owner: 1,
          supervisor: 2,
          teknisi: 3,
          customer: 4,
        }
        aVal = roleOrder[a.role] ?? 99
        bVal = roleOrder[b.role] ?? 99
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    setFilteredUsers(filtered)
  }, [users, searchQuery, sortField, sortDirection])

  const updateUserRole = useCallback(
    async (userId: string, newRole: UserRole) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) {
        toast.error('Failed to update role')
      } else {
        toast.success(`Role updated to ${newRole}`)
        fetchUsers()
        setEditingUser(null)
      }
    },
    [fetchUsers]
  )

  const addNewUser = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!newUser.email || !newUser.password || !newUser.full_name) {
        toast.error('All fields are required')
        return
      }

      if (newUser.password.length < 6) {
        toast.error('Password must be at least 6 characters')
        return
      }

      const loadingToast = toast.loading('Creating user...')

      try {
        const res = await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: newUser.email,
            password: newUser.password,
            full_name: newUser.full_name,
            role: newUser.role,
          }),
        })

        const result = await res.json()

        if (!res.ok) {
          throw new Error(result.error || 'Failed to create user')
        }

        toast.success(`User ${newUser.full_name} created!`, { id: loadingToast })
        setShowAddUser(false)
        setNewUser({ email: '', full_name: '', role: 'customer', password: '' })
        fetchUsers()
      } catch (err: any) {
        toast.error(err.message || 'Failed to create user', { id: loadingToast })
      }
    },
    [newUser, fetchUsers]
  )

  const roles: UserRole[] = ['admin', 'teknisi', 'supervisor', 'owner', 'customer']

  const handleDeleteUser = useCallback(async () => {
    if (!deletingUser) return

    setDeleting(true)
    const loadingToast = toast.loading('Deleting user...')

    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: deletingUser.id }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Failed to delete user')
      }

      toast.success(`User ${deletingUser.full_name} deleted`, { id: loadingToast })
      setDeletingUser(null)
      fetchUsers()
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user', { id: loadingToast })
    } finally {
      setDeleting(false)
    }
  }, [deletingUser, fetchUsers])

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const copyUserId = (userId: string) => {
    navigator.clipboard.writeText(userId)
    setCopiedId(userId)
    toast.success('User ID copied!')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getRoleIcon = (role: string) => {
    switch(role) {
      case 'admin': return <Shield className="w-4 h-4" />
      case 'owner': return <Star className="w-4 h-4" />
      case 'supervisor': return <UserCheck className="w-4 h-4" />
      case 'teknisi': return <Wrench className="w-4 h-4" />
      default: return <User className="w-4 h-4" />
    }
  }

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'admin': return 'bg-[#E94560]/10 text-[#E94560] border-[#E94560]/20'
      case 'owner': return 'bg-[#F1C40F]/10 text-[#F1C40F] border-[#F1C40F]/20'
      case 'supervisor': return 'bg-[#2ECC71]/10 text-[#2ECC71] border-[#2ECC71]/20'
      case 'teknisi': return 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20'
      default: return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  const getRoleLabel = (role: string) => {
    switch(role) {
      case 'admin': return 'Administrator'
      case 'owner': return 'Owner'
      case 'supervisor': return 'Supervisor'
      case 'teknisi': return 'Teknisi'
      default: return 'Customer'
    }
  }

  // Role statistics
  const roleStats = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[#E94560] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-gray-500 font-medium">Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A2E]">User Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage user roles and permissions</p>
        </div>
        <button
          onClick={() => setShowAddUser(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#E94560] text-white rounded-lg hover:bg-[#c73d54] transition-all text-sm font-medium"
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Role Statistics */}
      {showRoleStats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {roles.map((role) => (
            <div
              key={role}
              className="bg-white rounded-lg border border-[#E9ECEF] p-3 text-center shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                {getRoleIcon(role)}
                <span className="text-xs font-medium text-gray-500 capitalize">{role}</span>
              </div>
              <p className="text-xl font-bold text-[#1A1A2E]">{roleStats[role] || 0}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white rounded-xl border border-[#E9ECEF] p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
            placeholder="Search by name, email, or role..."
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-[#E9ECEF] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#FAFAFA]">
              <tr>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('full_name')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-[#1A1A2E] transition-colors"
                  >
                    Name
                    {sortField === 'full_name' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('email')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-[#1A1A2E] transition-colors"
                  >
                    Email
                    {sortField === 'email' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('role')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-[#1A1A2E] transition-colors"
                  >
                    Role
                    {sortField === 'role' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">User ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9ECEF]">
              <AnimatePresence>
                {filteredUsers.map((user, index) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: index * 0.01 }}
                    className="hover:bg-[#FAFAFA] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#1A1A2E] rounded-full flex items-center justify-center text-white font-semibold text-xs">
                          {user.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-[#1A1A2E]">{user.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        {user.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {editingUser === user.id ? (
                        <select
                          value={selectedRole}
                          onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                          className="px-3 py-1.5 border border-[#E9ECEF] rounded-lg text-sm focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 bg-white"
                          autoFocus
                        >
                          {roles.map((role) => (
                            <option key={role} value={role} className="capitalize">{role}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleColor(user.role)}`}>
                          {getRoleIcon(user.role)}
                          {getRoleLabel(user.role)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs font-mono text-gray-400 bg-[#FAFAFA] px-2 py-0.5 rounded border border-[#E9ECEF] truncate max-w-[80px]">
                          {user.id.slice(0, 8)}...
                        </code>
                        <button
                          onClick={() => copyUserId(user.id)}
                          className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                          title="Copy User ID"
                        >
                          {copiedId === user.id ? (
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {editingUser === user.id ? (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => updateUserRole(user.id, selectedRole)}
                            className="p-1.5 text-[#2ECC71] hover:bg-green-50 rounded-lg transition-colors"
                            title="Save"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingUser(null)}
                            className="p-1.5 text-[#E94560] hover:bg-red-50 rounded-lg transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              setEditingUser(user.id)
                              setSelectedRole(user.role)
                            }}
                            className="p-1.5 text-[#3B82F6] hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Role"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingUser(user)}
                            className="p-1.5 text-[#E94560] hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400 font-medium">No users found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your search</p>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 border border-[#E9ECEF] shadow-xl"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-[#1A1A2E] rounded-lg flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1A1A2E]">Add New User</h3>
                <p className="text-xs text-gray-400">Create a new user account</p>
              </div>
            </div>

            <form onSubmit={addNewUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Full Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Email Address</label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
                <input
                  type="password"
                  placeholder="Min 6 characters"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
                >
                  {roles.map((role) => (
                    <option key={role} value={role} className="capitalize">{role}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 bg-[#E94560] text-white font-medium py-2.5 rounded-lg hover:bg-[#c73d54] transition-all text-sm"
                >
                  Add User
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="flex-1 bg-white text-[#1A1A2E] font-medium py-2.5 rounded-lg border border-[#E9ECEF] hover:bg-gray-50 transition-all text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl w-full max-w-md p-6 border border-[#E9ECEF] shadow-xl"
          >
            <div className="text-center">
              <div className="w-14 h-14 bg-[#E94560]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-7 h-7 text-[#E94560]" />
              </div>
              <h3 className="text-lg font-bold text-[#1A1A2E] mb-2">Delete User</h3>
              <p className="text-gray-500 mb-1">
                Are you sure you want to delete <span className="font-semibold text-[#1A1A2E]">{deletingUser.full_name}</span>?
              </p>
              <p className="text-sm text-[#E94560] font-medium">This action cannot be undone.</p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setDeletingUser(null)}
                  disabled={deleting}
                  className="flex-1 bg-white text-[#1A1A2E] font-medium py-2.5 rounded-lg border border-[#E9ECEF] hover:bg-gray-50 transition-all text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={deleting}
                  className="flex-1 bg-[#E94560] text-white font-medium py-2.5 rounded-lg hover:bg-[#c73d54] transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

// Import missing icons
import { Star, Wrench, User } from 'lucide-react'
