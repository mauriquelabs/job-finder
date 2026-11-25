import {
  defaultCvDocsCandidates,
  readCvDoc,
  resolveCvDocsDir,
} from "../../../../../src/cv/library";
import { handleUpdateCvDoc } from "../../../../../src/cv/docs-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const { id } = await context.params;
  const docsDir = await resolveCvDocsDir(defaultCvDocsCandidates());

  if (docsDir === null) {
    return Response.json(
      { error: "That CV is not in the saved list." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await readCvDoc(docsDir, id);

  if (!result.ok) {
    return Response.json(
      { error: result.message },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    { markdown: result.markdown },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { id } = await context.params;
  return handleUpdateCvDoc(request, id);
}
