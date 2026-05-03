import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

type ReviewRow = {
  id: string;
  product_id: string;
  reviewer_name: string;
  rating: number;
  comment: string;
  created_at: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json({ success: false, message: "productId is required." }, { status: 400 });
    }

    const db = getFirebaseAdminDb();
    const snap = await db
      .collection("reviews")
      .where("product_id", "==", productId)
      .orderBy("created_at", "desc")
      .limit(100)
      .get();

    const reviews: ReviewRow[] = snap.docs.map((doc) => {
      const data = doc.data() as Omit<ReviewRow, "id">;
      return {
        id: doc.id,
        product_id: data.product_id,
        reviewer_name: data.reviewer_name,
        rating: Number(data.rating),
        comment: data.comment,
        created_at: typeof data.created_at === "string" ? data.created_at : new Date().toISOString(),
      };
    });

    return NextResponse.json({ success: true, reviews });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load reviews.";
    if (message.includes("NOT_FOUND")) {
      return NextResponse.json({ success: true, reviews: [] });
    }
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      productId?: string;
      reviewerName?: string;
      rating?: number;
      comment?: string;
    };

    if (!body.productId || !body.reviewerName || !body.comment || !body.rating) {
      return NextResponse.json({ success: false, message: "Missing required review fields." }, { status: 400 });
    }

    const rating = Number(body.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, message: "Rating must be between 1 and 5." }, { status: 400 });
    }

    const db = getFirebaseAdminDb();
    await db.collection("reviews").add({
      product_id: body.productId,
      reviewer_name: body.reviewerName.trim(),
      rating,
      comment: body.comment.trim(),
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save review.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
