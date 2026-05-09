import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/apiResponse";
import { getAuthUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import Case from "@/models/Case";

export async function GET(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    await connectDB();

    const user = getAuthUser(req);
    if (!user) return ApiResponse.unauthorized();
    if (user.role !== "admin") return ApiResponse.error("Only admins can view case files.", 403);

    const { caseId } = await params;
    const caseItem = await Case.findOne({ caseId });
    if (!caseItem) return ApiResponse.notFound("Case");

    const fileResponse = await fetch(caseItem.caseFile);
    if (!fileResponse.ok) {
      return ApiResponse.error("Unable to load case file.", 502);
    }

    const bytes = await fileResponse.arrayBuffer();

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${caseItem.caseId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/admin/cases/[caseId]/file:", error);
    return ApiResponse.error("Internal Server Error");
  }
}
