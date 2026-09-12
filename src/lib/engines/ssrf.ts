const PRIVATE_HOST =
  /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|::1|\[::1\])/i;

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

export function assertPublicHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new SsrfError("invalid url");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new SsrfError("protocol must be http or https");
  }
  const host = u.hostname.toLowerCase();
  if (PRIVATE_HOST.test(host)) {
    throw new SsrfError("private host denied");
  }
  if (host.endsWith(".local") || host.endsWith(".internal")) {
    throw new SsrfError("internal suffix denied");
  }
  const m = host.match(/^172\.(\d+)\./);
  if (m) {
    const oct = Number(m[1]);
    if (oct >= 16 && oct <= 31) throw new SsrfError("private host denied");
  }
  return u;
}

export function isDeniedUrl(raw: string): boolean {
  try {
    assertPublicHttpUrl(raw);
    return false;
  } catch {
    return true;
  }
}
