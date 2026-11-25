import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  markdownBodyTooLarge,
  MAX_MARKDOWN_BYTES,
  parseCreateCvRequest,
  parseMarkdownRequest,
  pdfFromMarkdown,
  previewFromMarkdown,
} from "../../src/cv/site.js";

describe("parseMarkdownRequest", () => {
  it("reads a markdown field", () => {
    const result = parseMarkdownRequest(
      JSON.stringify({ markdown: "# Daniel Sierra\n\nRole" }),
    );

    assert.deepEqual(result, {
      ok: true,
      markdown: "# Daniel Sierra\n\nRole",
    });
  });

  it("rejects empty markdown", () => {
    const result = parseMarkdownRequest(JSON.stringify({ markdown: "   " }));

    assert.deepEqual(result, {
      ok: false,
      status: 400,
      message: "Paste a CV to preview or download.",
    });
  });

  it("rejects a body that is not JSON with a markdown field", () => {
    assert.deepEqual(parseMarkdownRequest("not json"), {
      ok: false,
      status: 400,
      message: "Send JSON with a markdown field.",
    });
    assert.deepEqual(parseMarkdownRequest(JSON.stringify({ text: "cv" })), {
      ok: false,
      status: 400,
      message: "Send JSON with a markdown field.",
    });
  });

  it("rejects markdown larger than 200 KB", () => {
    const result = parseMarkdownRequest("x".repeat(MAX_MARKDOWN_BYTES + 1));

    assert.deepEqual(result, {
      ok: false,
      status: 413,
      message: "Markdown is larger than 200 KB.",
    });
  });
});

describe("parseCreateCvRequest", () => {
  it("reads role and markdown", () => {
    assert.deepEqual(
      parseCreateCvRequest(
        JSON.stringify({ role: " FDE ", markdown: "# Daniel\n" }),
      ),
      { ok: true, role: "FDE", markdown: "# Daniel\n" },
    );
  });

  it("rejects a missing or blank role", () => {
    assert.deepEqual(
      parseCreateCvRequest(JSON.stringify({ markdown: "# Daniel\n" })),
      {
        ok: false,
        status: 400,
        message: "Send JSON with a role and markdown field.",
      },
    );
    assert.deepEqual(
      parseCreateCvRequest(
        JSON.stringify({ role: "  ", markdown: "# Daniel\n" }),
      ),
      {
        ok: false,
        status: 400,
        message: "Enter a short role label for the new CV.",
      },
    );
  });
});

describe("markdownBodyTooLarge", () => {
  it("reads the content-length header", () => {
    assert.equal(markdownBodyTooLarge(null), false);
    assert.equal(markdownBodyTooLarge(String(MAX_MARKDOWN_BYTES)), false);
    assert.equal(markdownBodyTooLarge(String(MAX_MARKDOWN_BYTES + 1)), true);
  });
});

describe("previewFromMarkdown", () => {
  it("returns the full CV document and a filename from the heading", () => {
    const result = previewFromMarkdown(
      "# Daniel Sierra\n\n## Experience\n\nDetails",
    );

    assert.equal(result.filename, "Daniel-Sierra.pdf");
    assert.match(result.html, /<!doctype html>/i);
    assert.match(result.html, /<title>Daniel Sierra<\/title>/);
    assert.match(result.html, /<h1>Daniel Sierra<\/h1>/);
    assert.match(result.html, /<h2>Experience<\/h2>/);
  });
});

describe("pdfFromMarkdown", () => {
  it("renders inner HTML through the given renderer", async () => {
    const calls: Array<{ content: string; title: string }> = [];

    const result = await pdfFromMarkdown(
      "# Daniel Sierra\n\n## Experience\n\nDetails",
      async (content, title) => {
        calls.push({ content, title });
        return Buffer.from("%PDF-stub");
      },
    );

    assert.equal(result.filename, "Daniel-Sierra.pdf");
    assert.equal(result.pdf.toString(), "%PDF-stub");
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.title, "Daniel Sierra");
    assert.match(calls[0]?.content ?? "", /<h1>Daniel Sierra<\/h1>/);
    assert.doesNotMatch(calls[0]?.content ?? "", /<!doctype html>/i);
  });
});
