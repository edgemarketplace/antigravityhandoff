import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type RecordPaidOrderUsageInput = {
  tenantId: string;
  orderId: string;
  amountCents: number;
};

function computeFeeCents(amountCents: number, currentPlan: string): number {
  if (currentPlan !== "free") return 0;
  return Math.max(0, Math.round(amountCents * 0.05));
}

export async function recordPaidOrderUsage(input: RecordPaidOrderUsageInput): Promise<{ applied: boolean; feeCents: number }> {
  const supabase = getSupabaseAdminClient();

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("current_plan")
    .eq("id", input.tenantId)
    .maybeSingle();

  if (tenantError || !tenant) {
    throw new Error(`Could not resolve tenant plan for usage tracking: ${tenantError?.message ?? "tenant not found"}`);
  }

  const amountCents = Math.max(0, Math.round(input.amountCents));
  const feeCents = computeFeeCents(amountCents, tenant.current_plan);

  const { error: insertError } = await supabase.from("usage_events").insert({
    tenant_id: input.tenantId,
    event_type: "order_completed",
    amount_cents: amountCents,
    fee_cents: feeCents,
    event_key: input.orderId,
    metadata: {
      order_id: input.orderId,
      current_plan: tenant.current_plan,
    },
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { applied: false, feeCents };
    }
    throw new Error(`Could not write usage event: ${insertError.message}`);
  }

  const { error: usageError } = await supabase.rpc("increment_tenant_usage", {
    p_tenant_id: input.tenantId,
    p_amount_cents: amountCents,
    p_fee_cents: feeCents,
  });

  if (usageError) {
    throw new Error(`Could not update tenant usage counters: ${usageError.message}`);
  }

  return { applied: true, feeCents };
}
