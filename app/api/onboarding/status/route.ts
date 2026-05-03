import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const intakeId = requestUrl.searchParams.get("intake_id")?.trim();

  if (!intakeId) {
    return NextResponse.json({ success: false, message: "intake_id query parameter is required." }, { status: 400 });
  }

  const db = getFirebaseAdminDb();
  const intakeSnap = await db.collection("onboarding_intakes").doc(intakeId).get();

  if (!intakeSnap.exists) {
    return NextResponse.json({ success: false, message: "Intake not found" }, { status: 404 });
  }

  const intake = intakeSnap.data();
  const tenantId = typeof intake?.tenant_id === "string" ? intake.tenant_id : null;

  let tenant: Record<string, unknown> | null = null;
  if (tenantId) {
    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    tenant = tenantSnap.exists ? (tenantSnap.data() as Record<string, unknown>) : null;
  }

  return NextResponse.json({ success: true, intake, tenant });
}
