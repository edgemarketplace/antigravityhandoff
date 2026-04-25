import { NextResponse } from "next/server";
import { ADMIN_WRITE_ROLES, requireTenantMembership } from "@/lib/admin-auth";
import { resolveTenantFromRequest } from "@/lib/tenant-context";
import {
  createStripeConnectOnboardingLink,
  getOrCreateStripeConnectAccount,
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

  try {
    const accountId = await getOrCreateStripeConnectAccount({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
    });

    const statusSnapshot = await refreshStripeConnectStatus(accountId);

    await syncStripeConnectRecord({
      tenantId: tenant.id,
      accountId,
      status: statusSnapshot.status,
      metadata: statusSnapshot.metadata,
    });

    const onboardingUrl = await createStripeConnectOnboardingLink({
      accountId,
      tenantSlug: tenant.slug,
    });

    return NextResponse.json({
      success: true,
      account_id: accountId,
      account_status: statusSnapshot.status,
      onboarding_url: onboardingUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create Stripe Connect onboarding session.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
