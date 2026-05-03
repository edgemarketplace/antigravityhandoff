import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/components/ProductDetailClient";
import { Reviews } from "@/components/Reviews";
import { findProductByPrintifyId } from "@/lib/firebase-data";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

type ProductRecord = {
  printify_id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string | null;
  image_urls: string[] | null;
  variants: unknown;
};

type CachedVariant = {
  id: number;
  title: string;
  price: number;
  is_enabled?: boolean;
};

function toVariants(value: unknown): CachedVariant[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<CachedVariant>;
    if (typeof candidate.id !== "number" || typeof candidate.title !== "string" || typeof candidate.price !== "number") {
      return [];
    }
    return [
      {
        id: candidate.id,
        title: candidate.title,
        price: candidate.price,
        is_enabled: typeof candidate.is_enabled === "boolean" ? candidate.is_enabled : true,
      },
    ];
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;

  const data = await findProductByPrintifyId(id);

  if (!data) {
    notFound();
  }

  const product = data as ProductRecord;
  const imageUrls = (product.image_urls ?? []).filter(Boolean);
  if (!imageUrls.length && product.image_url) {
    imageUrls.push(product.image_url);
  }

  const variants = toVariants(product.variants);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-10 px-6 py-8 md:px-10">
      <ProductDetailClient
        productId={product.printify_id}
        title={product.title}
        description={product.description}
        fallbackPrice={Number(product.price || 0)}
        imageUrls={imageUrls}
        variants={variants}
      />

      <Reviews productId={product.printify_id} />
    </main>
  );
}
