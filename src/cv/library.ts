import { access, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { MAX_MARKDOWN_BYTES } from "./site.js";

const CV_DOC_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const CV_DOC_PREFIX = "Daniel_Sierra_";
const CV_DOC_SUFFIX = "_CV";

export type CvDocSummary = {
  id: string;
  label: string;
};

export type CvDocRead =
  | { ok: true; markdown: string }
  | { ok: false; status: 404 | 413; message: string };

export type CvDocWrite =
  | { ok: true; id: string; label: string }
  | { ok: false; status: 400 | 404 | 409 | 413; message: string };

const missingDocMessage = "That CV is not in the saved list.";

const missingDoc: CvDocRead = {
  ok: false,
  status: 404,
  message: missingDocMessage,
};

const missingWrite: CvDocWrite = {
  ok: false,
  status: 404,
  message: missingDocMessage,
};

export function isCvDocId(id: string): boolean {
  return CV_DOC_ID.test(id);
}

export function cvDocLabel(filename: string): string {
  const extension = path.extname(filename);
  let stem = extension.length > 0 ? filename.slice(0, -extension.length) : filename;
  stem = stem.replace(/^Daniel_Sierra_/, "");
  stem = stem.replace(/^CV_/, "");
  stem = stem.replace(/_CV$/, "");
  stem = stem.replace(/_CV_/g, "_");

  return stem.replaceAll("_", " ").trim();
}

/** Build `Daniel_Sierra_<Role>_CV` from a short role label. */
export function cvDocIdFromRole(role: string): string | null {
  const cleaned = role
    .trim()
    .replaceAll(/['’]/g, "")
    .replaceAll(/[^A-Za-z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "")
    .replaceAll(/_+/g, "_");

  if (cleaned.length === 0) {
    return null;
  }

  const id = `${CV_DOC_PREFIX}${cleaned}${CV_DOC_SUFFIX}`;

  return isCvDocId(id) ? id : null;
}

function resolveDocPath(
  docsDir: string,
  id: string,
): { ok: true; root: string; filePath: string } | { ok: false } {
  if (!isCvDocId(id)) {
    return { ok: false };
  }

  const root = path.resolve(docsDir);
  const filePath = path.resolve(root, `${id}.md`);

  if (path.dirname(filePath) !== root) {
    return { ok: false };
  }

  return { ok: true, root, filePath };
}

function markdownWriteError(markdown: string): CvDocWrite | null {
  if (markdown.trim().length === 0) {
    return {
      ok: false,
      status: 400,
      message: "Paste a CV to preview or download.",
    };
  }

  if (Buffer.byteLength(markdown, "utf8") > MAX_MARKDOWN_BYTES) {
    return {
      ok: false,
      status: 413,
      message: "Markdown is larger than 200 KB.",
    };
  }

  return null;
}

export function defaultCvDocsCandidates(
  cwd = process.cwd(),
  envDir = process.env.CV_DOCS_DIR,
): string[] {
  const candidates = [
    envDir,
    path.resolve(cwd, "data", "cv", "docs"),
    path.resolve(cwd, "..", "data", "cv", "docs"),
  ];

  return candidates.filter(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.length > 0,
  );
}

export async function resolveCvDocsDir(
  candidates: readonly string[],
): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);

      if (info.isDirectory()) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function idFromFilename(filename: string): string | null {
  if (path.extname(filename).toLowerCase() !== ".md") {
    return null;
  }

  const id = filename.slice(0, -path.extname(filename).length);

  return CV_DOC_ID.test(id) ? id : null;
}

export async function listCvDocs(docsDir: string): Promise<CvDocSummary[]> {
  const entries = await readdir(docsDir, { withFileTypes: true });
  const documents: CvDocSummary[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const id = idFromFilename(entry.name);

    if (id === null) {
      continue;
    }

    documents.push({ id, label: cvDocLabel(entry.name) });
  }

  documents.sort((left, right) => {
    const byLabel = left.label.localeCompare(right.label);

    return byLabel === 0 ? left.id.localeCompare(right.id) : byLabel;
  });

  return documents;
}

export async function readCvDoc(docsDir: string, id: string): Promise<CvDocRead> {
  const resolved = resolveDocPath(docsDir, id);

  if (!resolved.ok) {
    return missingDoc;
  }

  try {
    const info = await stat(resolved.filePath);

    if (!info.isFile()) {
      return missingDoc;
    }

    if (info.size > MAX_MARKDOWN_BYTES) {
      return {
        ok: false,
        status: 413,
        message: "Markdown is larger than 200 KB.",
      };
    }

    return { ok: true, markdown: await readFile(resolved.filePath, "utf8") };
  } catch {
    return missingDoc;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Overwrite an existing `{id}.md`. Fails if the file is missing. */
export async function writeCvDoc(
  docsDir: string,
  id: string,
  markdown: string,
): Promise<CvDocWrite> {
  const sizeError = markdownWriteError(markdown);

  if (sizeError !== null) {
    return sizeError;
  }

  const resolved = resolveDocPath(docsDir, id);

  if (!resolved.ok) {
    return missingWrite;
  }

  if (!(await fileExists(resolved.filePath))) {
    return missingWrite;
  }

  await writeFile(resolved.filePath, markdown, "utf8");

  return {
    ok: true,
    id,
    label: cvDocLabel(`${id}.md`),
  };
}

/** Create a new `{id}.md`. Fails with 409 if the file already exists. */
export async function createCvDoc(
  docsDir: string,
  id: string,
  markdown: string,
): Promise<CvDocWrite> {
  const sizeError = markdownWriteError(markdown);

  if (sizeError !== null) {
    return sizeError;
  }

  const resolved = resolveDocPath(docsDir, id);

  if (!resolved.ok) {
    return {
      ok: false,
      status: 400,
      message: "Use a short role label made of letters, numbers, spaces, or hyphens.",
    };
  }

  try {
    await writeFile(resolved.filePath, markdown, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      return {
        ok: false,
        status: 409,
        message: "A CV with that role already exists. Choose another label or open the saved file.",
      };
    }

    throw error;
  }

  return {
    ok: true,
    id,
    label: cvDocLabel(`${id}.md`),
  };
}
