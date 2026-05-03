import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { listTenantProducts } from "@/lib/firebase-data";
import { resolveTenantBySlug } from "@/lib/tenant-context";

type TenantStorePageProps = {
  params: Promise<{ tenant_slug: string }>;
};

type TenantRecord = {
  id: string;
  slug: string;
  name: string;
  primary_color: string | null;
  logo_url: string | null;
};

type TenantProductRecord = {
  printify_id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string | null;
  variants: Array<unknown> | null;
};

export default async function TenantStorePage({ params }: TenantStorePageProps) {
  const { tenant_slug } = await params;

  const tenant = await resolveTenantBySlug(tenant_slug);

  if (!tenant) {
    notFound();
  }

  const typedTenant = tenant as TenantRecord;
  const accent = typedTenant.primary_color ?? "#f97316";

  const typedProducts: TenantProductRecord[] = (await listTenantProducts(typedTenant.id)) as TenantProductRecord[];

  return (
    <main className="mx-auto w-full max-w-7xl space-y-10 px-6 py-8 md:px-10">
      <header className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs tracking-[0.2em] text-zinc-500 uppercase">Tenant storefront</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{typedTenant.name}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Tenant slug: <span className="font-mono">{typedTenant.slug}</span>
        </p>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Primary color</span>
          <span className="h-6 w-6 rounded-full border border-black/20" style={{ backgroundColor: accent }} />
          <code className="rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-900">{accent}</code>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Catalog</h2>
          <Link href="/admin" className="text-sm text-orange-600 underline underline-offset-4 dark:text-orange-300">
            Open admin
          </Link>
        </div>

        {typedProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            No products yet for this tenant. Seed products with the same <code>tenant_id</code> as this store.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {typedProducts.map((product) => (
              <ProductCard
                key={product.printify_id}
                printifyId={product.printify_id}
                title={product.title}
                description={product.description}
                price={Number(product.price || 0)}
                imageUrl={product.image_url}
                variantCount={Array.isArray(product.variants) ? product.variants.length : 0}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
