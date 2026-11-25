import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  handleCreateCvDoc,
  handleUpdateCvDoc,
} from "../../src/cv/docs-route.js";

describe("cv docs write routes", () => {
  const previousDocsDir = process.env.CV_DOCS_DIR;
  const previousFly = process.env.FLY_APP_NAME;
  const previousSecret = process.env.CV_SAVE_SECRET;
  let dir: string | undefined;

  afterEach(async () => {
    if (previousDocsDir === undefined) {
      delete process.env.CV_DOCS_DIR;
    } else {
      process.env.CV_DOCS_DIR = previousDocsDir;
    }

    if (previousFly === undefined) {
      delete process.env.FLY_APP_NAME;
    } else {
      process.env.FLY_APP_NAME = previousFly;
    }

    if (previousSecret === undefined) {
      delete process.env.CV_SAVE_SECRET;
    } else {
      process.env.CV_SAVE_SECRET = previousSecret;
    }

    if (dir !== undefined) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it("creates and updates markdown under CV_DOCS_DIR locally", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "cv-docs-route-"));
    process.env.CV_DOCS_DIR = dir;
    delete process.env.FLY_APP_NAME;

    const createResponse = await handleCreateCvDoc(
      new Request("http://127.0.0.1/api/cv-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "Staff Engineer",
          markdown: "# Staff\n",
        }),
      }),
    );

    assert.equal(createResponse.status, 200);
    assert.deepEqual(await createResponse.json(), {
      id: "Daniel_Sierra_Staff_Engineer_CV",
      label: "Staff Engineer",
    });
    assert.equal(
      await readFile(
        path.join(dir, "Daniel_Sierra_Staff_Engineer_CV.md"),
        "utf8",
      ),
      "# Staff\n",
    );

    const updateResponse = await handleUpdateCvDoc(
      new Request("http://127.0.0.1/api/cv-docs/Daniel_Sierra_Staff_Engineer_CV", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: "# Staff updated\n" }),
      }),
      "Daniel_Sierra_Staff_Engineer_CV",
    );

    assert.equal(updateResponse.status, 200);
    assert.equal(
      await readFile(
        path.join(dir, "Daniel_Sierra_Staff_Engineer_CV.md"),
        "utf8",
      ),
      "# Staff updated\n",
    );
  });

  it("requires the Fly save secret before writing", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "cv-docs-route-"));
    await writeFile(path.join(dir, "Daniel_Sierra_FDE_CV.md"), "# FDE\n");
    process.env.CV_DOCS_DIR = dir;
    process.env.FLY_APP_NAME = "job-finder-cv-portfolio";
    process.env.CV_SAVE_SECRET = "fly-secret";

    const denied = await handleUpdateCvDoc(
      new Request("http://example/api/cv-docs/Daniel_Sierra_FDE_CV", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: "# Nope\n" }),
      }),
      "Daniel_Sierra_FDE_CV",
    );

    assert.equal(denied.status, 401);

    const allowed = await handleUpdateCvDoc(
      new Request("http://example/api/cv-docs/Daniel_Sierra_FDE_CV", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer fly-secret",
        },
        body: JSON.stringify({ markdown: "# Allowed\n" }),
      }),
      "Daniel_Sierra_FDE_CV",
    );

    assert.equal(allowed.status, 200);
    assert.equal(
      await readFile(path.join(dir, "Daniel_Sierra_FDE_CV.md"), "utf8"),
      "# Allowed\n",
    );
  });
});
