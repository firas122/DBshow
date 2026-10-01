import { isIP } from "node:net";

/**
 * Pure helpers for deciding whether an address points somewhere a public
 * proxy must never connect to (loopback, private ranges, link-local, etc.).
 * No I/O here so it can be unit-checked in isolation.
 */

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => acc * 256 + Number(part), 0);
}

const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, cloud metadata
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
];

function isBlockedIPv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  return BLOCKED_V4.some(([base, bits]) => {
    const size = 2 ** (32 - bits);
    const start = ipv4ToInt(base);
    return value >= start && value < start + size;
  });
}

/** Expands any valid IPv6 text form into eight 16-bit groups. */
function expandIPv6(ip: string): number[] | null {
  let text = ip.toLowerCase();
  const zone = text.indexOf("%");
  if (zone !== -1) text = text.slice(0, zone);

  // Convert a trailing dotted IPv4 (::ffff:1.2.3.4) into two hex groups.
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    if (isIP(tail) !== 4) return null;
    const n = ipv4ToInt(tail);
    text = `${text.slice(0, lastColon + 1)}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;

  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  const parsed = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return parsed.length === 8 && parsed.every((g) => !Number.isNaN(g)) ? parsed : null;
}

function isBlockedIPv6(ip: string): boolean {
  const g = expandIPv6(ip);
  if (!g) return true; // unparseable: fail closed

  const allZeroTo = (n: number) => g.slice(0, n).every((x) => x === 0);

  if (allZeroTo(7) && (g[7] === 0 || g[7] === 1)) return true; // :: and ::1

  // IPv4-mapped (::ffff:a.b.c.d) and deprecated IPv4-compatible (::a.b.c.d)
  if (allZeroTo(5) && (g[5] === 0xffff || g[5] === 0)) {
    return isBlockedIPv4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);
  }
  // NAT64 prefix 64:ff9b::/96 embeds an IPv4 address
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return isBlockedIPv4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);
  }

  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

/** True when the literal IP address must not be contacted by the proxy. */
export function isBlockedAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, "");
  const family = isIP(bare);
  if (family === 4) return isBlockedIPv4(bare);
  if (family === 6) return isBlockedIPv6(bare);
  return true; // not an IP at all: fail closed
}

/** Cheap name-based pre-check; real protection is the resolved-address check. */
export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".internal") || host.endsWith(".local")) return true;
  if (isIP(host)) return isBlockedAddress(host);
  return false;
}
