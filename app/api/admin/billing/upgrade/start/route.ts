import { NextResponse } from "next/server";
import { ADMIN_WRITE_ROLES, requireTenantMembership } from "@/lib/admin-auth";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveTenantFromRequest } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

function resolveAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function POST(request: Request) {
  const tenant = await resolveTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ success: false, message: "Tenant context not found." }, { status: 400 });
  }

  const auth = await requireTenantMembership(request, tenant.id, ADMIN_WRITE_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const growthPriceId = process.env.STRIPE_GROWTH_PRICE_ID;
  if (!growthPriceId) {
    return NextResponse.json(
      { success: false, message: "Missing STRIPE_GROWTH_PRICE_ID configuration." },
      { status: 500 },
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data: tenantBilling, error: billingError } = await supabase
    .from("tenants")
    .select("id,name,slug,stripe_customer_id,current_plan")
    .eq("id", tenant.id)
    .maybeSingle();

  if (billingError || !tenantBilling) {
    return NextResponse.json(
      { success: false, message: billingError?.message ?? "Tenant billing state not found." },
      { status: 500 },
    );
  }

  if (tenantBilling.current_plan === "growth") {
    return NextResponse.json(
      { success: false, message: "Tenant is already on Growth plan." },
      { status: 400 },
    );
  }

  const stripe = getStripe();

  let customerId = tenantBilling.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: auth.user.email ?? undefined,
      name: tenantBilling.name,
      metadata: {
        tenant_id: tenant.id,
        tenant_slug: tenant.slug,
      },
    });

    customerId = customer.id;

    const { error: customerUpdateError } = await supabase
      .from("tenants")
      .update({ stripe_customer_id: customerId, plan_updated_at: new Date().toISOString() })
      .eq("id", tenant.id);

    if (customerUpdateError) {
      return NextResponse.json({ success: false, message: customerUpdateError.message }, { status: 500 });
    }
  }

  const appUrl = resolveAppUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: growthPriceId, quantity: 1 }],
    success_url: `${appUrl}/admin?tenant=${encodeURIComponent(tenant.slug)}&billing=success`,
    cancel_url: `${appUrl}/admin?tenant=${encodeURIComponent(tenant.slug)}&billing=cancel`,
    metadata: {
      checkout_type: "growth_upgrade",
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
    },
    subscription_data: {
      metadata: {
        tenant_id: tenant.id,
        tenant_slug: tenant.slug,
        plan: "growth",
      },
    },
  });

  if (!session.url) {
    return NextResponse.json(
      { success: false, message: "Stripe upgrade session did not return a redirect URL." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    session_id: session.id,
    checkout_url: session.url,
  });
}
