/**
 * Local `pnpm dev` always allows saving markdown into data/cv/docs.
 * On Fly (FLY_APP_NAME set), writes require Authorization: Bearer <CV_SAVE_SECRET>
 * (or x-cv-save-secret). If the secret is unset on Fly, saves stay disabled.
 */

export type CvSaveAuth =
  | { ok: true }
  | { ok: false; status: 401 | 503; message: string };

export type CvSaveMode = "open" | "secret";

export function cvSaveMode(
  flyAppName = process.env.FLY_APP_NAME,
): CvSaveMode {
  return typeof flyAppName === "string" && flyAppName.trim().length > 0
    ? "secret"
    : "open";
}

export function authorizeCvSave(
  request: { headers: Headers },
  env: {
    flyAppName?: string | undefined;
    saveSecret?: string | undefined;
  } = {},
): CvSaveAuth {
  const mode = cvSaveMode(env.flyAppName ?? process.env.FLY_APP_NAME);

  if (mode === "open") {
    return { ok: true };
  }

  const secret = (env.saveSecret ?? process.env.CV_SAVE_SECRET)?.trim() ?? "";

  if (secret.length === 0) {
    return {
      ok: false,
      status: 503,
      message: "Saving is not configured on this host.",
    };
  }

  const bearer = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cv-save-secret");
  const presented =
    bearer?.startsWith("Bearer ") === true
      ? bearer.slice("Bearer ".length).trim()
      : headerSecret?.trim() ?? "";

  if (presented.length > 0 && presented === secret) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 401,
    message: "Saving requires the save secret.",
  };
}
