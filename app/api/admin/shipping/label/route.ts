import { NextResponse } from "next/server";
import { ADMIN_WRITE_ROLES, requireTenantMembership } from "@/lib/admin-auth";
import { createShippoLabel } from "@/lib/shippo";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { resolveTenantFromRequest } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

type Body = {
  orderId?: string;
  rateId?: string;
};

export async function POST(request: Request) {
  const tenant = await resolveTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ success: false, message: "Tenant context not found." }, { status: 400 });
  }

  const auth = await requireTenantMembership(request, tenant.id, ADMIN_WRITE_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const body = (await request.json()) as Body;
  const orderId = body.orderId?.trim();
  const rateId = body.rateId?.trim();

  if (!orderId || !rateId) {
    return NextResponse.json({ success: false, message: "orderId and rateId are required." }, { status: 400 });
  }

  try {
    const label = await createShippoLabel(rateId);
    const db = getFirebaseAdminDb();
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
    }

    const order = orderSnap.data() as { tenant_id?: string; customer_email?: string | null };
    if ((order.tenant_id ?? null) !== tenant.id) {
      return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
    }

    await orderRef.set(
      {
        shipping_label_id: label.transactionId,
        tracking_number: label.trackingNumber,
        tracking_url: label.trackingUrl,
        shipping_status: "label_purchased",
        shipped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { merge: true },
    );

    if (order.customer_email) {
      await db.collection("email_automation_events").doc(`shipping-${orderId}`).set(
        {
          tenant_id: tenant.id,
          event_type: "shipping_confirmation",
          recipient: order.customer_email,
          subject: `Your order ${orderId.slice(0, 8)} has shipped`,
          dedupe_key: `shipping-${orderId}`,
          payload: {
            tracking_number: label.trackingNumber,
            tracking_url: label.trackingUrl,
          },
          created_at: new Date().toISOString(),
        },
        { merge: true },
      );
    }

    return NextResponse.json({ success: true, orderId, ...label });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create shipping label";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
