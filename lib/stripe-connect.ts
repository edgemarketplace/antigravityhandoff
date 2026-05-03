import { getStripe } from "@/lib/stripe";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";

export const STRIPE_CONNECT_PROVIDER = "stripe_connect";

type TenantInput = {
  id: string;
  slug: string;
  name: string;
};

type PaymentAccountRecord = {
  account_ref: string;
  status: string;
  metadata: Record<string, unknown> | null;
};

function resolveAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function mapStripeAccountStatus(account: { charges_enabled: boolean; details_submitted: boolean }): string {
  if (account.charges_enabled && account.details_submitted) return "active";
  return "pending";
}

export async function getLatestStripeConnectAccountRecord(tenantId: string): Promise<PaymentAccountRecord | null> {
  const db = getFirebaseAdminDb();
  const snap = await db
    .collection("payment_accounts")
    .where("tenant_id", "==", tenantId)
    .where("provider", "==", STRIPE_CONNECT_PROVIDER)
    .orderBy("created_at", "desc")
    .limit(1)
    .get();

  if (snap.empty) return null;
  const data = snap.docs[0].data() as {
    account_ref?: string;
    status?: string;
    metadata?: Record<string, unknown> | null;
  };

  if (!data.account_ref || !data.status) return null;
  return {
    account_ref: data.account_ref,
    status: data.status,
    metadata: data.metadata ?? null,
  };
}

export async function syncStripeConnectRecord(params: {
  tenantId: string;
  accountId: string;
  status: string;
  metadata?: Record<string, unknown>;
}) {
  const db = getFirebaseAdminDb();
  const now = new Date().toISOString();
  const docId = `${params.tenantId}_${STRIPE_CONNECT_PROVIDER}_${params.accountId}`;

  await db
    .collection("payment_accounts")
    .doc(docId)
    .set(
      {
        tenant_id: params.tenantId,
        provider: STRIPE_CONNECT_PROVIDER,
        account_ref: params.accountId,
        status: params.status,
        metadata: params.metadata ?? {},
        created_at: now,
        updated_at: now,
      },
      { merge: true },
    );
}

export async function getOrCreateStripeConnectAccount(tenant: TenantInput): Promise<string> {
  const existing = await getLatestStripeConnectAccountRecord(tenant.id);
  if (existing?.account_ref) return existing.account_ref;

  const stripe = getStripe();
  const created = await stripe.accounts.create({
    type: "express",
    metadata: {
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      tenant_name: tenant.name,
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  const status = mapStripeAccountStatus(created);
  await syncStripeConnectRecord({
    tenantId: tenant.id,
    accountId: created.id,
    status,
    metadata: {
      charges_enabled: created.charges_enabled,
      details_submitted: created.details_submitted,
    },
  });

  return created.id;
}

export async function createStripeConnectOnboardingLink(params: { accountId: string; tenantSlug: string }) {
  const stripe = getStripe();
  const appUrl = resolveAppUrl().replace(/\/$/, "");

  const accountLink = await stripe.accountLinks.create({
    account: params.accountId,
    type: "account_onboarding",
    refresh_url: `${appUrl}/admin?tenant=${encodeURIComponent(params.tenantSlug)}&payments=refresh`,
    return_url: `${appUrl}/admin?tenant=${encodeURIComponent(params.tenantSlug)}&payments=return`,
  });

  return accountLink.url;
}

export async function refreshStripeConnectStatus(accountId: string): Promise<{ status: string; metadata: Record<string, unknown> }> {
  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(accountId);

  const status = mapStripeAccountStatus(account);
  return {
    status,
    metadata: {
      charges_enabled: account.charges_enabled,
      details_submitted: account.details_submitted,
      payouts_enabled: account.payouts_enabled,
      default_currency: account.default_currency,
    },
  };
}
