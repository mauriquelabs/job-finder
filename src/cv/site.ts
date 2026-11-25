import { buildCvDocument } from "./document.js";
import { cvFilenameFromMarkdown, cvTitleFromMarkdown } from "./filename.js";
import { markdownToHtml } from "./markdown-to-html.js";

export const MAX_MARKDOWN_BYTES = 200 * 1024;

export type MarkdownRequest =
  | { ok: true; markdown: string }
  | { ok: false; status: number; message: string };

export type CreateCvRequest =
  | { ok: true; role: string; markdown: string }
  | { ok: false; status: number; message: string };

export function markdownBodyTooLarge(contentLengthHeader: string | null): boolean {
  if (contentLengthHeader === null) {
    return false;
  }

  const length = Number(contentLengthHeader);

  return Number.isFinite(length) && length > MAX_MARKDOWN_BYTES;
}

type JsonObjectRequest =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; status: number; message: string };

function parseJsonObject(bodyText: string): JsonObjectRequest {
  if (Buffer.byteLength(bodyText, "utf8") > MAX_MARKDOWN_BYTES) {
    return {
      ok: false,
      status: 413,
      message: "Markdown is larger than 200 KB.",
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return {
      ok: false,
      status: 400,
      message: "Send JSON with a markdown field.",
    };
  }

  if (parsed === null || typeof parsed !== "object") {
    return {
      ok: false,
      status: 400,
      message: "Send JSON with a markdown field.",
    };
  }

  return { ok: true, value: parsed as Record<string, unknown> };
}

function readMarkdownField(parsed: Record<string, unknown>): MarkdownRequest {
  if (!("markdown" in parsed) || typeof parsed.markdown !== "string") {
    return {
      ok: false,
      status: 400,
      message: "Send JSON with a markdown field.",
    };
  }

  if (parsed.markdown.trim().length === 0) {
    return {
      ok: false,
      status: 400,
      message: "Paste a CV to preview or download.",
    };
  }

  return { ok: true, markdown: parsed.markdown };
}

export function parseMarkdownRequest(bodyText: string): MarkdownRequest {
  const parsed = parseJsonObject(bodyText);

  if (!parsed.ok) {
    return parsed;
  }

  return readMarkdownField(parsed.value);
}

export function parseCreateCvRequest(bodyText: string): CreateCvRequest {
  const parsed = parseJsonObject(bodyText);

  if (!parsed.ok) {
    return parsed;
  }

  const markdown = readMarkdownField(parsed.value);

  if (!markdown.ok) {
    return markdown;
  }

  if (!("role" in parsed.value) || typeof parsed.value.role !== "string") {
    return {
      ok: false,
      status: 400,
      message: "Send JSON with a role and markdown field.",
    };
  }

  const role = parsed.value.role.trim();

  if (role.length === 0) {
    return {
      ok: false,
      status: 400,
      message: "Enter a short role label for the new CV.",
    };
  }

  return { ok: true, role, markdown: markdown.markdown };
}

export function previewFromMarkdown(markdown: string): {
  html: string;
  filename: string;
} {
  const title = cvTitleFromMarkdown(markdown);

  return {
    html: buildCvDocument(markdownToHtml(markdown), title),
    filename: cvFilenameFromMarkdown(markdown),
  };
}

export async function pdfFromMarkdown(
  markdown: string,
  renderPdfBytes: (content: string, title: string) => Promise<Buffer>,
): Promise<{ pdf: Buffer; filename: string }> {
  const title = cvTitleFromMarkdown(markdown);
  const pdf = await renderPdfBytes(markdownToHtml(markdown), title);

  return { pdf, filename: cvFilenameFromMarkdown(markdown) };
}
