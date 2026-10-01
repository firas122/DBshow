import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

/** Blocks loopback, link-local and RFC1918 targets so the proxy can't be used to probe the host network. */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return true;
  if (host === "::1" || host === "0.0.0.0") return true;
  if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return true;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;

  const [a, b] = ipv4.slice(1).map(Number);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "Missing url parameter." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "That is not a valid URL." }, { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Only http(s) URLs are supported." }, { status: 400 });
  }
  if (isPrivateHost(parsed.hostname)) {
    return NextResponse.json(
      { error: "Refusing to fetch private or loopback addresses." },
      { status: 403 },
    );
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      redirect: "follow",
      headers: { accept: "*/*", "user-agent": "DBShow3D/1.0 (schema visualiser)" },
      signal: AbortSignal.timeout(20_000),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream responded with HTTP ${upstream.status}.` },
        { status: 502 },
      );
    }

    const declaredLength = Number(upstream.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_BYTES) {
      return NextResponse.json({ error: "That file is larger than 25 MB." }, { status: 413 });
    }

    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "That file is larger than 25 MB." }, { status: 413 });
    }

    return new NextResponse(buffer, {
      headers: {
        "content-type": "application/octet-stream",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "The request timed out after 20 seconds."
        : "Could not reach that URL.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
