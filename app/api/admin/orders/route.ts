import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@/lib/tenant-context";
import { ADMIN_READ_ROLES, requireTenantMembership } from "@/lib/admin-auth";
import { listTenantOrders } from "@/lib/firebase-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = await resolveTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ success: false, message: "Tenant context not found." }, { status: 400 });
  }

  const auth = await requireTenantMembership(request, tenant.id, ADMIN_READ_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const orders = await listTenantOrders(tenant.id, 25);
  return NextResponse.json({ success: true, tenant, orders });
}
