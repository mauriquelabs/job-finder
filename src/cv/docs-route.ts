import {
  createCvDoc,
  cvDocIdFromRole,
  defaultCvDocsCandidates,
  resolveCvDocsDir,
  writeCvDoc,
  type CvDocWrite,
} from "./library.js";
import { authorizeCvSave } from "./save-auth.js";
import {
  markdownBodyTooLarge,
  parseCreateCvRequest,
  parseMarkdownRequest,
} from "./site.js";

const noStore = { "Cache-Control": "no-store" };

async function docsDirOr404(): Promise<
  { ok: true; docsDir: string } | Response
> {
  const docsDir = await resolveCvDocsDir(defaultCvDocsCandidates());

  if (docsDir === null) {
    return Response.json(
      { error: "That CV is not in the saved list." },
      { status: 404, headers: noStore },
    );
  }

  return { ok: true, docsDir };
}

function authOrError(request: Request): Response | null {
  const auth = authorizeCvSave(request);

  if (auth.ok) {
    return null;
  }

  return Response.json(
    { error: auth.message },
    { status: auth.status, headers: noStore },
  );
}

function writeResponse(result: CvDocWrite): Response {
  if (!result.ok) {
    return Response.json(
      { error: result.message },
      { status: result.status, headers: noStore },
    );
  }

  return Response.json(
    { id: result.id, label: result.label },
    { headers: noStore },
  );
}

export async function handleUpdateCvDoc(
  request: Request,
  id: string,
): Promise<Response> {
  const denied = authOrError(request);

  if (denied !== null) {
    return denied;
  }

  if (markdownBodyTooLarge(request.headers.get("content-length"))) {
    return Response.json(
      { error: "Markdown is larger than 200 KB." },
      { status: 413, headers: noStore },
    );
  }

  const docs = await docsDirOr404();

  if (docs instanceof Response) {
    return docs;
  }

  const parsed = parseMarkdownRequest(await request.text());

  if (!parsed.ok) {
    return Response.json(
      { error: parsed.message },
      { status: parsed.status, headers: noStore },
    );
  }

  return writeResponse(await writeCvDoc(docs.docsDir, id, parsed.markdown));
}

export async function handleCreateCvDoc(request: Request): Promise<Response> {
  const denied = authOrError(request);

  if (denied !== null) {
    return denied;
  }

  if (markdownBodyTooLarge(request.headers.get("content-length"))) {
    return Response.json(
      { error: "Markdown is larger than 200 KB." },
      { status: 413, headers: noStore },
    );
  }

  const docs = await docsDirOr404();

  if (docs instanceof Response) {
    return docs;
  }

  const parsed = parseCreateCvRequest(await request.text());

  if (!parsed.ok) {
    return Response.json(
      { error: parsed.message },
      { status: parsed.status, headers: noStore },
    );
  }

  const id = cvDocIdFromRole(parsed.role);

  if (id === null) {
    return Response.json(
      {
        error:
          "Use a short role label made of letters, numbers, spaces, or hyphens.",
      },
      { status: 400, headers: noStore },
    );
  }

  return writeResponse(
    await createCvDoc(docs.docsDir, id, parsed.markdown),
  );
}
