import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";

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
  const db = getFirebaseAdminDb();
  const tenantRef = db.collection("tenants").doc(input.tenantId);
  const usageEventId = `${input.tenantId}_order_completed_${input.orderId}`;
  const usageRef = db.collection("usage_events").doc(usageEventId);

  const amountCents = Math.max(0, Math.round(input.amountCents));

  const result = await db.runTransaction(async (tx) => {
    const tenantSnap = await tx.get(tenantRef);
    if (!tenantSnap.exists) {
      throw new Error("Could not resolve tenant plan for usage tracking: tenant not found");
    }

    const tenant = tenantSnap.data() as { current_plan?: string };
    const currentPlan = tenant.current_plan ?? "free";
    const feeCents = computeFeeCents(amountCents, currentPlan);

    const existingUsage = await tx.get(usageRef);
    if (existingUsage.exists) {
      return { applied: false, feeCents };
    }

    tx.set(usageRef, {
      tenant_id: input.tenantId,
      event_type: "order_completed",
      amount_cents: amountCents,
      fee_cents: feeCents,
      event_key: input.orderId,
      metadata: { order_id: input.orderId, current_plan: currentPlan },
      created_at: new Date().toISOString(),
    });

    tx.set(
      tenantRef,
      {
        monthly_order_count: FieldValue.increment(1),
        monthly_gmv_cents: FieldValue.increment(amountCents),
        monthly_fee_cents: FieldValue.increment(feeCents),
        updated_at: new Date().toISOString(),
      },
      { merge: true },
    );

    return { applied: true, feeCents };
  });

  return result;
}
