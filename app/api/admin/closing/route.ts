import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create table script for manual setup in Supabase SQL editor
export const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_date DATE NOT NULL,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  total_expected BIGINT NOT NULL DEFAULT 0,
  total_actual BIGINT NOT NULL DEFAULT 0,
  difference BIGINT NOT NULL DEFAULT 0,
  detail JSONB DEFAULT '{}',
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  admin_notes TEXT,
  rejection_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_closings_date ON closings(closing_date);
CREATE INDEX IF NOT EXISTS idx_closings_status ON closings(status);

-- Grant access (service_role bypasses RLS but this ensures anon can too)
ALTER TABLE closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Full access via service_role" ON closings USING (true) WITH CHECK (true);`;

// Use service_role to bypass RLS
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function handleAction(action: string, payload: any) {
  switch (action) {
    case "create": {
      const { data, error } = await supabase.from("closings").insert(payload.data).select().single();
      if (error) throw error;
      return data;
    }
    case "approve": {
      const { data, error } = await supabase
        .from("closings")
        .update({ status: "approved", admin_notes: payload.admin_notes || null, updated_at: new Date().toISOString() })
        .eq("id", payload.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    case "list": {
      const { data, error } = await supabase.from("closings").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    }
    default:
      throw new Error("Invalid action");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await handleAction(body.action, body);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    // If table doesn't exist, provide setup instructions
    if (error.message?.includes("relation") && error.message?.includes("does not exist")) {
      return NextResponse.json({
        success: false,
        error: "Table 'closings' belum ada. Jalankan SQL berikut di Supabase SQL Editor:\n\n" + CREATE_TABLE_SQL,
        needsSetup: true,
        sql: CREATE_TABLE_SQL,
      }, { status: 200 });
    }
    console.error("Closing API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET endpoint to return the SQL for setup
export async function GET() {
  return NextResponse.json({ sql: CREATE_TABLE_SQL });
}
