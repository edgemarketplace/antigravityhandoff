import postgres from "postgres";

const dbUrl = process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error("SUPABASE_DB_URL is missing.");
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1 });

try {
  const updated = await sql`
    update public.tenants
    set
      monthly_order_count = 0,
      monthly_gmv_cents = 0,
      monthly_fee_cents = 0,
      last_billing_reset = now(),
      plan_updated_at = now()
    where coalesce(last_billing_reset, now() - interval '31 days') <= now() - interval '30 days'
    returning id
  `;

  console.log(JSON.stringify({ ok: true, reset_count: updated.length }));
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown reset failure";
  console.error(JSON.stringify({ ok: false, message }));
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
