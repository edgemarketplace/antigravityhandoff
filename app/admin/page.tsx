import Link from "next/link";
import { headers } from "next/headers";
import { AdminProductsManager } from "@/components/AdminProductsManager";
import { RealtimeOrdersPanel } from "@/components/RealtimeOrdersPanel";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveTenantBySlug } from "@/lib/tenant-context";

type AdminPageProps = {
  searchParams: Promise<{ tenant?: string }>;
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
    return (
      <main className="mx-auto w-full max-w-5xl space-y-4 px-6 py-8 md:px-10">
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Tenant context was not detected. Open this page on a tenant subdomain (for example
          <code> acme.edgecommerce.com/admin</code>) or pass <code>?tenant=acme</code>.
        </p>
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

  const supabase = getSupabaseAdminClient();

  const [{ data: products }, { data: orders }] = await Promise.all([
    supabase
      .from("products")
      .select("printify_id,title,description,price,image_url,variants,created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select(
        "id,stripe_session_id,customer_email,status,currency,amount_total,printify_order_id,fulfillment_attempts,fulfillment_error,created_at,updated_at,paid_at",
      )
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const initialProducts = ((products ?? []) as ProductRow[]).map((product) => ({
    ...product,
    price: Number(product.price || 0),
  }));

  const initialOrders = (orders ?? []) as OrderRow[];

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8 md:px-10">
      <header className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs tracking-[0.18em] text-zinc-500 uppercase">Tenant admin</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{tenant.name}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Slug: <code>{tenant.slug}</code>
        </p>
        <div className="mt-4">
          <Link href={`/stores/${tenant.slug}`} className="text-sm text-orange-600 underline underline-offset-4 dark:text-orange-300">
            View storefront
          </Link>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminProductsManager tenantSlug={tenant.slug} initialProducts={initialProducts} />
        <RealtimeOrdersPanel tenantId={tenant.id} tenantSlug={tenant.slug} initialOrders={initialOrders} />
      </div>
    </main>
  );
}
