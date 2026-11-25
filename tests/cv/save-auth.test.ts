import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorizeCvSave, cvSaveMode } from "../../src/cv/save-auth.js";

describe("cvSaveMode", () => {
  it("is open locally and secret on Fly", () => {
    assert.equal(cvSaveMode(undefined), "open");
    assert.equal(cvSaveMode(""), "open");
    assert.equal(cvSaveMode("job-finder-cv-portfolio"), "secret");
  });
});

describe("authorizeCvSave", () => {
  it("allows writes locally without a secret", () => {
    assert.deepEqual(
      authorizeCvSave(new Request("http://127.0.0.1/"), {
        flyAppName: "",
        saveSecret: "",
      }),
      { ok: true },
    );
  });

  it("rejects Fly writes when the secret is unset", () => {
    assert.deepEqual(
      authorizeCvSave(new Request("http://example/"), {
        flyAppName: "job-finder-cv-portfolio",
        saveSecret: "",
      }),
      {
        ok: false,
        status: 503,
        message: "Saving is not configured on this host.",
      },
    );
  });

  it("accepts a matching Bearer token or x-cv-save-secret on Fly", () => {
    const env = {
      flyAppName: "job-finder-cv-portfolio",
      saveSecret: "test-secret",
    };

    assert.deepEqual(
      authorizeCvSave(
        new Request("http://example/", {
          headers: { Authorization: "Bearer test-secret" },
        }),
        env,
      ),
      { ok: true },
    );

    assert.deepEqual(
      authorizeCvSave(
        new Request("http://example/", {
          headers: { "x-cv-save-secret": "test-secret" },
        }),
        env,
      ),
      { ok: true },
    );

    assert.deepEqual(
      authorizeCvSave(
        new Request("http://example/", {
          headers: { Authorization: "Bearer wrong" },
        }),
        env,
      ),
      {
        ok: false,
        status: 401,
        message: "Saving requires the save secret.",
      },
    );
  });
});
