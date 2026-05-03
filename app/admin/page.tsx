import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AdminProductsManager } from "@/components/AdminProductsManager";
import { RealtimeOrdersPanel } from "@/components/RealtimeOrdersPanel";
import { AdminSettingsPanel } from "@/components/AdminSettingsPanel";
import { AdminFeeTrackerCard } from "@/components/AdminFeeTrackerCard";
import { OnboardingProgressCard } from "@/components/OnboardingProgressCard";
import { AdminSignInGate } from "@/components/AdminSignInGate";
import { resolveTenantBySlug } from "@/lib/tenant-context";
import { ADMIN_READ_ROLES, getAuthenticatedUserFromRequest, isSuperAdminEmail, requireTenantMembership } from "@/lib/admin-auth";
import { getLatestStripePaymentAccount, listTenantOrders, listTenantProducts, listTenants, listUserMemberships, findTenantById } from "@/lib/firebase-data";

type AdminPageProps = {
  searchParams: Promise<{ tenant?: string }>;
};

type PaymentAccountRow = {
  account_ref: string;
  status: string;
};

type ProductRow = {
  printify_id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string | null;
  variants: unknown;
  created_at?: string;
};

type OrderRow = {
  id: string;
  stripe_session_id: string | null;
  customer_email: string | null;
  status: string;
  currency: string;
  amount_total: number | null;
  subtotal: number | null;
  stripe_fee: number | null;
  edge_payment_fee: number | null;
  shipping_base_cost: number | null;
  shipping_markup: number | null;
  total_paid: number | null;
  printify_order_id: string | null;
  fulfillment_attempts: number;
  fulfillment_error: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
};

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const resolvedParams = await searchParams;
  const headerStore = await headers();

  const tenantSlug =
    headerStore.get("x-tenant-slug")?.trim().toLowerCase() ?? resolvedParams.tenant?.trim().toLowerCase() ?? null;

  if (!tenantSlug) {
    const authRequest = new Request("http://localhost/admin", { headers: new Headers(headerStore) });
    const user = await getAuthenticatedUserFromRequest(authRequest);

    if (user && isSuperAdminEmail(user.email)) {
      const tenants = await listTenants(100);
      const firstTenantWithSlug = tenants.find((t) => typeof t.slug === "string" && t.slug.trim().length > 0);

      if (firstTenantWithSlug) {
        redirect(`/admin?tenant=${encodeURIComponent(firstTenantWithSlug.slug)}`);
      }

      return (
        <main className="mx-auto w-full max-w-5xl space-y-4 px-6 py-8 md:px-10">
          <h1 className="text-3xl font-semibold tracking-tight">Super Admin</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Signed in as {user.email ?? user.id}, but no tenants were found yet.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/onboarding" className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold uppercase">
              Start first test-store onboarding
            </Link>
          </div>
        </main>
      );
    }

    if (user) {
      const memberships = await listUserMemberships(user.id, user.email);
      if (memberships.length > 0) {
        const firstMembership = memberships[0];
        const tenant = await findTenantById(firstMembership.tenant_id);
        if (tenant && tenant.slug) {
          redirect(`/admin?tenant=${encodeURIComponent(tenant.slug)}`);
        }
      }
    }

    return (
      <main className="mx-auto w-full max-w-5xl space-y-4 px-6 py-8 md:px-10">
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {user ? (
            <>
              Signed in as <strong>{user.email ?? user.id}</strong>, but no tenant context was detected and you don't belong to any existing tenants yet. Open this page on a tenant subdomain (for example <code>acme.edgecommerce.com/admin</code>) or pass <code>?tenant=acme</code>.
            </>
          ) : (
            <>
              Tenant context was not detected. Open this page on a tenant subdomain (for example <code>acme.edgecommerce.com/admin</code>) or pass <code>?tenant=acme</code>.
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/onboarding" className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold uppercase">
            Start first test-store onboarding
          </Link>
          <Link href="/?tenant=demo" className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold uppercase">
            Go to storefront demo route
          </Link>
        </div>
        {!user && <AdminSignInGate />}
      </main>
    );
  }

  const tenant = await resolveTenantBySlug(tenantSlug);

  if (!tenant) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-4 px-6 py-8 md:px-10">
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Tenant <code>{tenantSlug}</code> does not exist yet. Seed a row in <code>public.tenants</code> first.
        </p>
      </main>
    );
  }

  const authRequest = new Request("http://localhost/admin", { headers: new Headers(headerStore) });
  const auth = await requireTenantMembership(authRequest, tenant.id, ADMIN_READ_ROLES);

  if (!auth.ok) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-4 px-6 py-8 md:px-10">
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{auth.message}</p>
        {auth.status === 401 && <AdminSignInGate />}
      </main>
    );
  }

  const [products, orders, paymentAccount] = await Promise.all([
    listTenantProducts(tenant.id),
    listTenantOrders(tenant.id, 25),
    getLatestStripePaymentAccount(tenant.id),
  ]);

  const initialProducts = (products as ProductRow[]).map((product) => ({
    ...product,
    price: Number(product.price || 0),
  }));

  const initialOrders = orders as OrderRow[];
  const paymentAccountState = (paymentAccount ?? null) as PaymentAccountRow | null;

  const initialSettings = {
    name: tenant.name,
    slug: tenant.slug,
    custom_domain: tenant.custom_domain ?? "",
    primary_color: tenant.primary_color ?? "",
    logo_url: tenant.logo_url ?? "",
    payment_mode: tenant.payment_mode,
    shipping_mode: tenant.shipping_mode,
    payment_fee_percent: Number(tenant.payment_fee_percent ?? 5),
    shipping_markup_percent: Number(tenant.shipping_markup_percent ?? 10),
  };

  const totalRevenue = initialOrders.reduce((sum, order) => sum + Number(order.total_paid ?? order.amount_total ?? 0), 0);
  const stripeFeesPaid = initialOrders.reduce((sum, order) => sum + Number(order.stripe_fee ?? 0), 0);
  const edgeFeesPaid = initialOrders.reduce((sum, order) => sum + Number(order.edge_payment_fee ?? 0), 0);
  const shippingMarginPaid = initialOrders.reduce((sum, order) => sum + Number(order.shipping_markup ?? 0), 0);
  const platformFeesPaid = edgeFeesPaid + shippingMarginPaid;

  const paymentSavings = tenant.payment_mode === "external" ? edgeFeesPaid : 0;
  const shippingSavings = tenant.shipping_mode === "external" ? shippingMarginPaid : 0;
  const totalSavings = paymentSavings + shippingSavings;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8 md:px-10">
      <header className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs tracking-[0.18em] text-zinc-500 uppercase">Tenant admin</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{tenant.name}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Slug: <code>{tenant.slug}</code>
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Signed in as {auth.user.email ?? auth.user.id} ({auth.membership.role})
        </p>
        <div className="mt-4">
          <Link href={`/stores/${tenant.slug}`} className="text-sm text-orange-600 underline underline-offset-4 dark:text-orange-300">
            View storefront
          </Link>
        </div>
      </header>

      <AdminFeeTrackerCard
        tenantSlug={tenant.slug}
        paymentMode={tenant.payment_mode}
        shippingMode={tenant.shipping_mode}
        totalRevenue={totalRevenue}
        stripeFeesPaid={stripeFeesPaid}
        edgeFeesPaid={edgeFeesPaid}
        shippingMarginPaid={shippingMarginPaid}
        platformFeesPaid={platformFeesPaid}
        totalSavings={totalSavings}
      />

      <OnboardingProgressCard
        onboardingStatus={tenant.onboarding_status}
        onboardingProgress={tenant.onboarding_progress}
        productCount={initialProducts.length}
        hasDomain={Boolean(tenant.custom_domain)}
        paymentMode={tenant.payment_mode}
        shippingMode={tenant.shipping_mode}
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminProductsManager tenantSlug={tenant.slug} initialProducts={initialProducts} />
        <RealtimeOrdersPanel tenantId={tenant.id} tenantSlug={tenant.slug} initialOrders={initialOrders} />
      </div>

      <AdminSettingsPanel
        tenantSlug={tenant.slug}
        initialSettings={initialSettings}
        initialStripeAccountRef={paymentAccountState?.account_ref ?? null}
        initialStripeAccountStatus={paymentAccountState?.status ?? null}
      />
    </main>
  );
}
