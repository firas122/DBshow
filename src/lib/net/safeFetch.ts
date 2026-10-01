import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { isBlockedAddress, isBlockedHostname } from "./ipGuard";

export class SafeFetchError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

export interface SafeFetchOptions {
  maxBytes: number;
  timeoutMs: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
}

/**
 * DNS lookup that refuses to hand back a private address. It runs at connect
 * time, so the address that is validated is the exact one the socket uses —
 * a hostile DNS server can't answer "public" for a check and "127.0.0.1" for
 * the real connection.
 */
const guardedLookup: typeof dns.lookup = ((
  hostname: string,
  options: dns.LookupOptions | number | undefined,
  callback: (...args: unknown[]) => void,
) => {
  const opts = typeof options === "object" && options ? options : {};
  dns.lookup(hostname, { ...opts, all: true }, (error, addresses) => {
    if (error) return callback(error);
    const list = addresses as dns.LookupAddress[];
    if (list.length === 0 || list.some((a) => isBlockedAddress(a.address))) {
      return callback(new SafeFetchError("Refusing to fetch private or loopback addresses.", 403));
    }
    if (opts.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}) as typeof dns.lookup;

function requestOnce(
  url: URL,
  { maxBytes, timeoutMs, headers }: SafeFetchOptions,
): Promise<{ status: number; location: string | null; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      { method: "GET", headers, lookup: guardedLookup, timeout: timeoutMs },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = typeof res.headers.location === "string" ? res.headers.location : null;

        if (status >= 300 && status < 400) {
          res.resume();
          resolve({ status, location, body: Buffer.alloc(0) });
          return;
        }

        const declared = Number(res.headers["content-length"] ?? 0);
        if (declared > maxBytes) {
          req.destroy();
          reject(new SafeFetchError("That file is larger than 25 MB.", 413));
          return;
        }

        const chunks: Buffer[] = [];
        let received = 0;
        res.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received > maxBytes) {
            req.destroy();
            reject(new SafeFetchError("That file is larger than 25 MB.", 413));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ status, location: null, body: Buffer.concat(chunks) }));
        res.on("error", reject);
      },
    );

    req.on("timeout", () => {
      req.destroy();
      reject(new SafeFetchError("The request timed out after 20 seconds.", 502));
    });
    req.on("error", reject);
    req.end();
  });
}

/**
 * GETs a public http(s) URL. Redirects are followed by hand so every hop is
 * re-validated, and the body is capped while streaming rather than after.
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions,
): Promise<{ body: Buffer }> {
  const maxRedirects = options.maxRedirects ?? 5;
  let url = new URL(rawUrl);

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new SafeFetchError("Only http(s) URLs are supported.", 400);
    }
    if (isBlockedHostname(url.hostname)) {
      throw new SafeFetchError("Refusing to fetch private or loopback addresses.", 403);
    }

    const result = await requestOnce(url, options);

    if (result.status >= 300 && result.status < 400 && result.location) {
      url = new URL(result.location, url);
      continue;
    }
    if (result.status < 200 || result.status >= 300) {
      throw new SafeFetchError(`Upstream responded with HTTP ${result.status}.`, 502);
    }
    return { body: result.body };
  }

  throw new SafeFetchError("Too many redirects.", 502);
}
