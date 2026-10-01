import { NextResponse } from "next/server";
import { SafeFetchError, safeFetch } from "@/lib/net/safeFetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

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

  try {
    const { body } = await safeFetch(parsed.toString(), {
      maxBytes: MAX_BYTES,
      timeoutMs: 20_000,
      headers: { accept: "*/*", "user-agent": "DBShow3D/1.0 (schema visualiser)" },
    });

    return new NextResponse(new Uint8Array(body), {
      headers: {
        "content-type": "application/octet-stream",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof SafeFetchError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not reach that URL." }, { status: 502 });
  }
}
