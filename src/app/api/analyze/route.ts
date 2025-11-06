import { NextResponse } from "next/server";
import analyzeAndPersist from "@/lib/analyzeAndPersist";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { imageBase64, imageId } = body as {
      imageBase64?: string;
      imageId?: number | string;
    };

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { success: false, error: "imageBase64 is required" },
        { status: 400 }
      );
    }

    // Call server-side helper to analyze and persist results
    const result = await analyzeAndPersist(imageBase64, imageId ?? null);

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
