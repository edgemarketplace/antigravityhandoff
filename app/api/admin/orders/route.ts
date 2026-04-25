import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveTenantFromRequest } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = await resolveTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ success: false, message: "Tenant context not found." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,stripe_session_id,customer_email,status,currency,amount_total,printify_order_id,fulfillment_attempts,fulfillment_error,created_at,updated_at,paid_at",
    )
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, tenant, orders: data ?? [] });
}
