import {
  CollectionReference,
  DocumentData,
  Query,
  Timestamp,
} from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import type { MembershipRow, OrderRow, PaymentAccountRow, ProductRow, TenantContext } from "@/lib/firebase-types";

function asIsoDate(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

function collection<T extends DocumentData>(name: string): CollectionReference<T> {
  return getFirebaseAdminDb().collection(name) as CollectionReference<T>;
}

export async function findTenantBySlug(slug: string): Promise<TenantContext | null> {
  try {
    const snapshot = await collection<TenantContext>("tenants").where("slug", "==", slug).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const data = doc.data();

    return {
      ...data,
      id: data.id ?? doc.id,
      onboarding_progress: data.onboarding_progress ?? {},
      payment_fee_percent: Number(data.payment_fee_percent ?? 5),
      shipping_markup_percent: Number(data.shipping_markup_percent ?? 10),
      monthly_order_count: Number(data.monthly_order_count ?? 0),
      monthly_gmv_cents: Number(data.monthly_gmv_cents ?? 0),
      monthly_fee_cents: Number(data.monthly_fee_cents ?? 0),
      last_billing_reset: data.last_billing_reset ?? null,
      onboarding_completed_at: data.onboarding_completed_at ?? null,
    };
  } catch {
    return null;
  }
}

export async function findMembership(tenantId: string, userId: string): Promise<MembershipRow | null> {
  const byDocId = await collection<MembershipRow>("members").doc(`${tenantId}_${userId}`).get();
  if (byDocId.exists) {
    const row = byDocId.data();
    if (row) return row;
  }

  const snapshot = await collection<MembershipRow>("members")
    .where("tenant_id", "==", tenantId)
    .where("user_id", "==", userId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].data();
}

export async function listTenantProducts(tenantId: string): Promise<ProductRow[]> {
  const snapshot = await collection<ProductRow>("products")
    .where("tenant_id", "==", tenantId)
    .orderBy("created_at", "desc")
    .get();

  return snapshot.docs.map((doc) => normalizeProduct(doc.id, doc.data()));
}

function normalizeProduct(docId: string, data: ProductRow): ProductRow {
  return {
    ...data,
    printify_id: data.printify_id ?? docId,
    image_urls: Array.isArray(data.image_urls) ? data.image_urls.filter(Boolean) : null,
    variants: Array.isArray(data.variants) ? data.variants : [],
    created_at: asIsoDate(data.created_at),
    updated_at: asIsoDate(data.updated_at),
  };
}

export async function listAllProducts(limit = 120): Promise<ProductRow[]> {
  const snapshot = await collection<ProductRow>("products").orderBy("created_at", "desc").limit(limit).get();
  return snapshot.docs.map((doc) => normalizeProduct(doc.id, doc.data()));
}

export async function listTenants(limit = 100): Promise<TenantContext[]> {
  const snapshot = await collection<TenantContext>("tenants").orderBy("created_at", "desc").limit(limit).get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      id: data.id ?? doc.id,
      onboarding_progress: data.onboarding_progress ?? {},
      payment_fee_percent: Number(data.payment_fee_percent ?? 5),
      shipping_markup_percent: Number(data.shipping_markup_percent ?? 10),
      monthly_order_count: Number(data.monthly_order_count ?? 0),
      monthly_gmv_cents: Number(data.monthly_gmv_cents ?? 0),
      monthly_fee_cents: Number(data.monthly_fee_cents ?? 0),
      last_billing_reset: data.last_billing_reset ?? null,
      onboarding_completed_at: data.onboarding_completed_at ?? null,
    };
  });
}

export async function findProductByPrintifyId(printifyId: string): Promise<ProductRow | null> {
  try {
    const snapshot = await collection<ProductRow>("products").where("printify_id", "==", printifyId).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return normalizeProduct(doc.id, doc.data());
  } catch {
    return null;
  }
}

export async function createTenantProduct(product: Omit<ProductRow, "created_at" | "updated_at">): Promise<ProductRow> {
  const nowIso = new Date().toISOString();
  const docId = `${product.tenant_id}_${product.printify_id}`;
  const payload: ProductRow = {
    ...product,
    created_at: nowIso,
    updated_at: nowIso,
  };

  await collection<ProductRow>("products").doc(docId).set(payload, { merge: true });
  return payload;
}

export async function updateTenantProduct(
  tenantId: string,
  printifyId: string,
  updates: Partial<Pick<ProductRow, "title" | "description" | "price" | "image_url">>,
): Promise<ProductRow | null> {
  const docId = `${tenantId}_${printifyId}`;
  const ref = collection<ProductRow>("products").doc(docId);
  const existing = await ref.get();
  if (!existing.exists) return null;

  const patchPayload = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  await ref.set(patchPayload, { merge: true });
  const next = await ref.get();
  const data = next.data();
  if (!data) return null;

  return {
    ...data,
    created_at: asIsoDate(data.created_at),
    updated_at: asIsoDate(data.updated_at),
    variants: Array.isArray(data.variants) ? data.variants : [],
  };
}

export async function deleteTenantProduct(tenantId: string, printifyId: string): Promise<void> {
  const docId = `${tenantId}_${printifyId}`;
  await collection<ProductRow>("products").doc(docId).delete();
}

export async function listTenantOrders(tenantId: string, limit = 25): Promise<OrderRow[]> {
  const snapshot = await collection<OrderRow>("orders")
    .where("tenant_id", "==", tenantId)
    .orderBy("created_at", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => {
    const row = doc.data();
    return {
      ...row,
      id: row.id ?? doc.id,
      created_at: asIsoDate(row.created_at),
      updated_at: asIsoDate(row.updated_at),
      paid_at: row.paid_at ? asIsoDate(row.paid_at) : null,
    };
  });
}

export async function getLatestStripePaymentAccount(tenantId: string): Promise<PaymentAccountRow | null> {
  const query: Query<PaymentAccountRow> = collection<PaymentAccountRow>("payment_accounts")
    .where("tenant_id", "==", tenantId)
    .where("provider", "==", "stripe_connect")
    .orderBy("created_at", "desc")
    .limit(1);

  const snapshot = await query.get();
  if (snapshot.empty) return null;
  const row = snapshot.docs[0].data();
  return {
    ...row,
    created_at: asIsoDate(row.created_at),
  };
}

export async function updateTenantById(tenantId: string, updates: Partial<TenantContext>): Promise<TenantContext | null> {
  const ref = collection<TenantContext>("tenants").doc(tenantId);
  await ref.set({ ...updates } as Partial<TenantContext>, { merge: true });
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (!data) return null;

  return {
    ...data,
    id: data.id ?? snap.id,
    onboarding_progress: data.onboarding_progress ?? {},
    payment_fee_percent: Number(data.payment_fee_percent ?? 5),
    shipping_markup_percent: Number(data.shipping_markup_percent ?? 10),
    monthly_order_count: Number(data.monthly_order_count ?? 0),
    monthly_gmv_cents: Number(data.monthly_gmv_cents ?? 0),
    monthly_fee_cents: Number(data.monthly_fee_cents ?? 0),
    last_billing_reset: data.last_billing_reset ?? null,
    onboarding_completed_at: data.onboarding_completed_at ?? null,
  };
}
