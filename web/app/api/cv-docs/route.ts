import { handleCreateCvDoc } from "../../../../src/cv/docs-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleCreateCvDoc(request);
}
