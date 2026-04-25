import { NextResponse } from "next/server";
import { ADMIN_WRITE_ROLES, requireTenantMembership } from "@/lib/admin-auth";
import { resolveTenantFromRequest } from "@/lib/tenant-context";
import {
  createStripeConnectOnboardingLink,
  getLatestStripeConnectAccountRecord,
  refreshStripeConnectStatus,
  syncStripeConnectRecord,
} from "@/lib/stripe-connect";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const tenant = await resolveTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ success: false, message: "Tenant context not found." }, { status: 400 });
  }

  const auth = await requireTenantMembership(request, tenant.id, ADMIN_WRITE_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const existing = await getLatestStripeConnectAccountRecord(tenant.id);
  if (!existing?.account_ref) {
    return NextResponse.json(
      { success: false, message: "No Stripe Connect account is linked yet. Start onboarding first." },
      { status: 400 },
    );
  }

  try {
    const statusSnapshot = await refreshStripeConnectStatus(existing.account_ref);

    await syncStripeConnectRecord({
      tenantId: tenant.id,
      accountId: existing.account_ref,
      status: statusSnapshot.status,
      metadata: statusSnapshot.metadata,
    });

    const onboardingUrl = await createStripeConnectOnboardingLink({
      accountId: existing.account_ref,
      tenantSlug: tenant.slug,
    });

    return NextResponse.json({
      success: true,
      account_id: existing.account_ref,
      account_status: statusSnapshot.status,
      onboarding_url: onboardingUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not refresh Stripe Connect onboarding.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
