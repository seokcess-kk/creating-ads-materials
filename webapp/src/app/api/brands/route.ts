import { NextResponse } from "next/server";
import { createBrand } from "@/lib/db/brands";

export async function POST(request: Request) {
  try {
    const { name, websiteUrl } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "브랜드명은 필수입니다" }, { status: 400 });
    }

    const brand = await createBrand(name.trim(), websiteUrl?.trim());
    return NextResponse.json(brand);
  } catch (error) {
    console.error("Brand creation error:", error);
    return NextResponse.json(
      { error: "브랜드 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
