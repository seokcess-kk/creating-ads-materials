import { NextResponse } from "next/server";
import { z } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function ok<T>(data: T) {
  return NextResponse.json(data);
}

export function fail(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function serverError(e: unknown) {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  const msg = e instanceof Error ? e.message : "Internal error";
  return NextResponse.json({ error: msg }, { status: 500 });
}

// z.infer<S> = 파싱 후(output) 타입 — .default()/.transform()이 있는 스키마도 정확히 추론.
// (z.ZodType<T>는 Output=Input을 가정해 default가 있는 필드를 optional(input)로 잘못 추론함)
export async function parseJson<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  const raw = await request.json();
  const result = schema.safeParse(raw);
  if (!result.success) {
    const msg = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    throw new ApiError(400, `입력 검증 실패: ${msg}`);
  }
  return result.data;
}
