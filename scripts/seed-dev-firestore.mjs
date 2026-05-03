import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function normalizePrivateKey(value) {
  return String(value ?? '').replace(/\\n/g, '\n');
}

function getServiceAccount() {
  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) : null;

  let pathJson = null;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const absolutePath = resolvePath(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (!existsSync(absolutePath)) throw new Error(`Service account file not found: ${absolutePath}`);
    pathJson = JSON.parse(readFileSync(absolutePath, 'utf8'));
  }

  const projectId = envJson?.project_id ?? pathJson?.project_id ?? process.env.FIREBASE_PROJECT_ID;
  const clientEmail = envJson?.client_email ?? pathJson?.client_email ?? process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(envJson?.private_key ?? pathJson?.private_key ?? process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase credentials (project_id, client_email, private_key).');
  }

  return { projectId, clientEmail, privateKey };
}

async function main() {
  const serviceAccount = getServiceAccount();
  if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });

  const db = getFirestore();
  const now = new Date().toISOString();

  const tenantId = 'tenant_firehouse_apparel';
  const tenantSlug = 'firehouse-apparel';
  const productId = 'showcase-1';
  const orderId = 'order_seed_001';

  await db.collection('tenants').doc(tenantId).set({
    id: tenantId,
    slug: tenantSlug,
    name: 'Firehouse Apparel',
    custom_domain: null,
    primary_color: '#ff4d00',
    logo_url: null,
    plan: 'growth',
    theme_name: 'edge-vibrant',
    payment_mode: 'edge',
    shipping_mode: 'edge',
    payment_fee_percent: 5,
    shipping_markup_percent: 10,
    onboarding_status: 'ready_to_launch',
    onboarding_progress: { intake: true, ai: true, products: true, provisioning: true, admin: true, emails: true, shipping: true },
    onboarding_completed_at: now,
    current_plan: 'free',
    monthly_order_count: 1,
    monthly_gmv_cents: 3499,
    monthly_fee_cents: 175,
    last_billing_reset: now,
    created_at: now,
    updated_at: now,
  }, { merge: true });

  await db.collection('products').doc(`${tenantId}_${productId}`).set({
    tenant_id: tenantId,
    printify_id: productId,
    title: 'Firehouse Classic Tee',
    description: 'Premium tee for first responder supporters.',
    price: 34.99,
    image_url: 'https://images.printify.com/mock/firehouse-classic-tee.jpg',
    image_urls: ['https://images.printify.com/mock/firehouse-classic-tee.jpg'],
    variants: [{ id: 1, title: 'M / Red', price: 3499, is_enabled: true }],
    created_at: now,
    updated_at: now,
  }, { merge: true });

  await db.collection('orders').doc(orderId).set({
    id: orderId,
    tenant_id: tenantId,
    stripe_session_id: 'cs_test_seed_001',
    customer_email: 'buyer@example.com',
    status: 'Paid',
    currency: 'usd',
    amount_total: 34.99,
    subtotal: 34.99,
    stripe_fee: 1.35,
    edge_payment_fee: 0.17,
    shipping_base_cost: 5.99,
    shipping_markup: 0.6,
    total_paid: 34.99,
    cart_items: [{ name: 'Firehouse Classic Tee' }],
    shipping_address: { city: 'Denver', state: 'CO', country: 'US' },
    paid_at: now,
    created_at: now,
    updated_at: now,
    fulfillment_attempts: 0,
    fulfillment_error: null,
  }, { merge: true });

  console.log(JSON.stringify({ success: true, tenantId, tenantSlug, productId, orderId }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ success: false, message }, null, 2));
  process.exit(1);
});
