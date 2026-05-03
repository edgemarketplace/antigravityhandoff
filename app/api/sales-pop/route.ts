import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

type SalesPopRow = {
  id: string;
  shipping_address: {
    city?: string;
    state?: string;
    country?: string;
  } | null;
  cart_items:
    | Array<{
        name?: string;
      }>
    | null;
  paid_at: string | null;
};

export async function GET() {
  try {
    const db = getFirebaseAdminDb();
    const snap = await db.collection("orders").where("status", "==", "Paid").orderBy("paid_at", "desc").limit(5).get();

    const rows = snap.docs.map((doc) => {
      const row = doc.data() as SalesPopRow;
      return {
        id: row.id ?? doc.id,
        city: row.shipping_address?.city ?? "your area",
        region: row.shipping_address?.state ?? row.shipping_address?.country ?? "US",
        productName: row.cart_items?.[0]?.name ?? "Fire Engine Tee",
      };
    });

    return NextResponse.json({ success: true, items: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load sales pop feed.";
    if (message.includes("NOT_FOUND")) {
      return NextResponse.json({ success: true, items: [] });
    }
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
