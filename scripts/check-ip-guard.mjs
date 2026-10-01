// Run: node --experimental-strip-types scripts/check-ip-guard.mjs
import assert from "node:assert/strict";
import { isBlockedAddress, isBlockedHostname } from "../src/lib/net/ipGuard.ts";

const blockedAddresses = [
  "127.0.0.1", "127.255.255.254", "10.0.0.1", "172.16.0.1", "172.31.255.255",
  "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1",
  "255.255.255.255", "::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1",
  "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a00:1", "::ffff:169.254.169.254",
  "::127.0.0.1", "64:ff9b::7f00:1", "[::1]", "not-an-ip",
];
const allowedAddresses = [
  "8.8.8.8", "1.1.1.1", "172.15.255.255", "172.32.0.1", "100.63.255.255",
  "2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8",
];
const blockedHostnames = [
  "localhost", "LOCALHOST", "foo.localhost", "db.internal", "printer.local",
  "127.0.0.1", "[::1]", "169.254.169.254", "localhost.",
];
// Real sites that the old prefix check ("fc"/"fd") wrongly rejected.
const allowedHostnames = ["fcc.gov", "fdic.gov", "example.com", "raw.githubusercontent.com"];

for (const a of blockedAddresses) assert.equal(isBlockedAddress(a), true, `should block ${a}`);
for (const a of allowedAddresses) assert.equal(isBlockedAddress(a), false, `should allow ${a}`);
for (const h of blockedHostnames) assert.equal(isBlockedHostname(h), true, `should block host ${h}`);
for (const h of allowedHostnames) assert.equal(isBlockedHostname(h), false, `should allow host ${h}`);

console.log(
  `ok: ${blockedAddresses.length + allowedAddresses.length} address and ${blockedHostnames.length + allowedHostnames.length} hostname checks passed`,
);
