"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type ProductRow = {
  printify_id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string | null;
  variants: unknown;
  created_at?: string;
};

type AdminProductsManagerProps = {
  tenantSlug: string;
  initialProducts: ProductRow[];
};

type EditingState = Record<
  string,
  {
    title: string;
    description: string;
    price: string;
    image_url: string;
  }
>;

export function AdminProductsManager({ tenantSlug, initialProducts }: AdminProductsManagerProps) {
  const [products, setProducts] = useState<ProductRow[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrice, setNewPrice] = useState("0");
  const [newImageUrl, setNewImageUrl] = useState("");

  const [editing, setEditing] = useState<EditingState>(() =>
    Object.fromEntries(
      initialProducts.map((product) => [
        product.printify_id,
        {
          title: product.title,
          description: product.description ?? "",
          price: String(product.price ?? 0),
          image_url: product.image_url ?? "",
        },
      ]),
    ),
  );

  const hasProducts = useMemo(() => products.length > 0, [products.length]);

  function primeEditing(nextProducts: ProductRow[]) {
    setEditing((prev) => {
      const next: EditingState = { ...prev };

      for (const product of nextProducts) {
        if (!next[product.printify_id]) {
          next[product.printify_id] = {
            title: product.title,
            description: product.description ?? "",
            price: String(product.price ?? 0),
            image_url: product.image_url ?? "",
          };
        }
      }

      return next;
    });
  }

  async function refreshProducts() {
    const response = await fetch(`/api/admin/products?tenant=${tenantSlug}`, { cache: "no-store" });
    const payload = (await response.json()) as {
      success: boolean;
      products?: ProductRow[];
      message?: string;
    };

    if (!response.ok || !payload.success) {
      throw new Error(payload.message ?? "Failed to load products.");
    }

    const nextProducts = payload.products ?? [];
    setProducts(nextProducts);
    primeEditing(nextProducts);
  }

  async function handleCreate() {
    if (!newTitle.trim()) {
      setMessage("Title is required.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(`/api/admin/products?tenant=${tenantSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          price: Number(newPrice),
          image_url: newImageUrl,
        }),
      });

      const payload = (await response.json()) as { success: boolean; message?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? "Failed to create product.");
      }

      await refreshProducts();
      setNewTitle("");
      setNewDescription("");
      setNewPrice("0");
      setNewImageUrl("");
      setMessage("Product created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create product.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(printifyId: string) {
    const row = editing[printifyId];
    if (!row) return;

    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(`/api/admin/products?tenant=${tenantSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printify_id: printifyId,
          title: row.title,
          description: row.description,
          price: Number(row.price),
          image_url: row.image_url,
        }),
      });

      const payload = (await response.json()) as { success: boolean; message?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? "Failed to save product.");
      }

      await refreshProducts();
      setMessage(`Saved ${printifyId}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save product.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(printifyId: string) {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(
        `/api/admin/products?tenant=${tenantSlug}&printify_id=${encodeURIComponent(printifyId)}`,
        {
          method: "DELETE",
        },
      );

      const payload = (await response.json()) as { success: boolean; message?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? "Failed to delete product.");
      }

      await refreshProducts();
      setMessage(`Deleted ${printifyId}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete product.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Products</h2>
        <p className="text-xs tracking-[0.14em] text-zinc-500 uppercase">Tenant-scoped product CRUD</p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 md:grid-cols-2">
        <input
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder="Product title"
          className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        />
        <input
          value={newPrice}
          onChange={(event) => setNewPrice(event.target.value)}
          placeholder="Price"
          className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        />
        <input
          value={newImageUrl}
          onChange={(event) => setNewImageUrl(event.target.value)}
          placeholder="Image URL"
          className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700 md:col-span-2"
        />
        <textarea
          value={newDescription}
          onChange={(event) => setNewDescription(event.target.value)}
          placeholder="Description"
          rows={2}
          className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700 md:col-span-2"
        />
        <Button disabled={loading} onClick={handleCreate} className="w-fit bg-orange-600 hover:bg-orange-700">
          Add product
        </Button>
      </div>

      {message ? <p className="text-sm text-zinc-600 dark:text-zinc-300">{message}</p> : null}

      {!hasProducts ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
          No products for this tenant yet.
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => {
            const row = editing[product.printify_id] ?? {
              title: product.title,
              description: product.description ?? "",
              price: String(product.price ?? 0),
              image_url: product.image_url ?? "",
            };

            return (
              <article key={product.printify_id} className="space-y-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                <p className="font-mono text-[10px] tracking-[0.16em] text-zinc-500 uppercase">{product.printify_id}</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    value={row.title}
                    onChange={(event) =>
                      setEditing((prev) => ({
                        ...prev,
                        [product.printify_id]: { ...row, title: event.target.value },
                      }))
                    }
                    className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                  />
                  <input
                    value={row.price}
                    onChange={(event) =>
                      setEditing((prev) => ({
                        ...prev,
                        [product.printify_id]: { ...row, price: event.target.value },
                      }))
                    }
                    className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                  />
                  <input
                    value={row.image_url}
                    onChange={(event) =>
                      setEditing((prev) => ({
                        ...prev,
                        [product.printify_id]: { ...row, image_url: event.target.value },
                      }))
                    }
                    placeholder="Image URL"
                    className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700 md:col-span-2"
                  />
                  <textarea
                    value={row.description}
                    rows={2}
                    onChange={(event) =>
                      setEditing((prev) => ({
                        ...prev,
                        [product.printify_id]: { ...row, description: event.target.value },
                      }))
                    }
                    className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700 md:col-span-2"
                  />
                </div>
                <div className="flex gap-2">
                  <Button disabled={loading} onClick={() => handleSave(product.printify_id)} variant="secondary">
                    Save
                  </Button>
                  <Button disabled={loading} onClick={() => handleDelete(product.printify_id)} variant="destructive">
                    Delete
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
