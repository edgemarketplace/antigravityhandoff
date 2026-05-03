import { ProductCard } from "@/components/ProductCard";
import { listAllProducts } from "@/lib/firebase-data";

type ProductRecord = {
  printify_id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string | null;
  image_urls: string[] | null;
  variants: Array<unknown> | null;
};

const showcaseProducts: ProductRecord[] = [
  {
    printify_id: "showcase-1",
    title: "Station Crest Oversized Tee",
    description: "Heavyweight cotton with a clean front crest and oversized street fit.",
    price: 34,
    image_url: null,
    image_urls: null,
    variants: ["S", "M", "L", "XL"],
  },
  {
    printify_id: "showcase-2",
    title: "After Shift Utility Hoodie",
    description: "Soft-brushed fleece hoodie designed for post-shift recovery and daily wear.",
    price: 62,
    image_url: null,
    image_urls: null,
    variants: ["S", "M", "L"],
  },
  {
    printify_id: "showcase-3",
    title: "Engine Co. Graphic Long Sleeve",
    description: "Minimal front logo, bold back graphic inspired by urban station signage.",
    price: 44,
    image_url: null,
    image_urls: null,
    variants: ["M", "L", "XL"],
  },
  {
    printify_id: "showcase-4",
    title: "Responder Everyday Cap",
    description: "Low-profile cap with tonal embroidery and a broken-in feel.",
    price: 28,
    image_url: null,
    image_urls: null,
    variants: ["One Size"],
  },
  {
    printify_id: "showcase-5",
    title: "Field Notes Pocket Tee",
    description: "Garment-dyed pocket tee built for everyday layering and movement.",
    price: 36,
    image_url: null,
    image_urls: null,
    variants: ["S", "M", "L", "XL"],
  },
  {
    printify_id: "showcase-6",
    title: "Midnight Unit Jogger",
    description: "Clean tapered jogger with utility pocket and premium stretch waistband.",
    price: 52,
    image_url: null,
    image_urls: null,
    variants: ["S", "M", "L"],
  },
  {
    printify_id: "showcase-7",
    title: "Engine House Coach Jacket",
    description: "Lightweight coach jacket with snap front and weather-ready finish.",
    price: 78,
    image_url: null,
    image_urls: null,
    variants: ["M", "L", "XL"],
  },
  {
    printify_id: "showcase-8",
    title: "Crew Supply Tote",
    description: "Structured daily tote for gym gear, station essentials, and travel carry.",
    price: 24,
    image_url: null,
    image_urls: null,
    variants: ["One Size"],
  },
];

export async function ProductGrid() {
  let products: ProductRecord[] = [];
  let errorMessage: string | null = null;

  try {
    products = (await listAllProducts(120)) as ProductRecord[];
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Failed to load products.";
  }

  const usingFallback = errorMessage !== null || products.length === 0;
  const renderedProducts = usingFallback ? showcaseProducts : products;

  return (
    <div className="space-y-4">
      {usingFallback ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs tracking-[0.08em] text-amber-800 uppercase dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">
          Demo mode active while live catalog sync is being connected.
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
        {renderedProducts.map((product) => (
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
      </section>
    </div>
  );
}
