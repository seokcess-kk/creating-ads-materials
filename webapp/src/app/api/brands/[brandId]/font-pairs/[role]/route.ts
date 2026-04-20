import { deleteFontPair, type FontRole } from "@/lib/memory";
import { ApiError, ok, serverError } from "@/lib/api-utils";

const ROLES = ["headline", "sub", "cta", "brand", "slogan"] as const;

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ brandId: string; role: string }> },
) {
  try {
    const { brandId, role } = await params;
    if (!(ROLES as readonly string[]).includes(role)) {
      throw new ApiError(400, `유효하지 않은 role: ${role}`);
    }
    await deleteFontPair(brandId, role as FontRole);
    return ok({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
