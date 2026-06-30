// Standalone test for the order-id helpers (no test framework configured).
// Run: npx tsx src/services/order-id.test.ts
import assert from "node:assert";
import { compTag, buildPaymentOrderId } from "./order-id";

let passed = 0;
const ok = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

// ── compTag ───────────────────────────────────────────────────────────────
ok("compTag: canonical slug → tag", () => {
  assert.strictEqual(compTag("emc"), "EMC");
  assert.strictEqual(compTag("komodo"), "KOMODO");
  assert.strictEqual(compTag("ispo"), "ISPO");
});
ok("compTag: operator slug collapses to first segment", () => {
  assert.strictEqual(compTag("emc-mathematics-competition-final-euef7"), "EMC");
  assert.strictEqual(compTag("international-greenwich-olympiad-f3i6d"), "INTERNAT"); // 8-char cap
});
ok("compTag: falls back to name, then COMP", () => {
  assert.strictEqual(compTag(null, "Owlypia Online"), "OWLYPIA");
  assert.strictEqual(compTag("", ""), "COMP");
  assert.strictEqual(compTag(null, null), "COMP");
});
ok("compTag: strips non-alphanumerics", () => {
  assert.strictEqual(compTag("emc_2026!"), "EMC2026");
});

// ── buildPaymentOrderId ─────────────────────────────────────────────────────
ok("orderId: canonical shape from registration_number", () => {
  assert.strictEqual(
    buildPaymentOrderId({ tag: "EMC", ref: "CTZ-2026-10156", ts: 1719765432123 }),
    "CTZ-EMC-10156-1719765432123",
  );
});
ok("orderId: uses last segment of the ref", () => {
  assert.strictEqual(
    buildPaymentOrderId({ tag: "KOMODO", ref: "CTZ-2026-99999", ts: 1 }),
    "CTZ-KOMODO-99999-1",
  );
});
ok("orderId: uuid fallback ref still produces a valid id", () => {
  const id = buildPaymentOrderId({ tag: "EMC", ref: "a1b2c3d4", ts: 1719765432123 });
  assert.strictEqual(id, "CTZ-EMC-a1b2c3d4-1719765432123");
});
ok("orderId: never exceeds Midtrans 50-char limit", () => {
  const id = buildPaymentOrderId({ tag: "ABCDEFGH", ref: "CTZ-2026-123456789012", ts: 1719765432123 });
  assert.ok(id.length <= 50, `length ${id.length} > 50`);
});
ok("orderId: distinct ts → distinct id (idempotent re-payment safe)", () => {
  const a = buildPaymentOrderId({ tag: "EMC", ref: "CTZ-2026-10156", ts: 100 });
  const b = buildPaymentOrderId({ tag: "EMC", ref: "CTZ-2026-10156", ts: 101 });
  assert.notStrictEqual(a, b);
});
ok("orderId: only safe chars (alnum + dash)", () => {
  const id = buildPaymentOrderId({ tag: "EMC", ref: "CTZ-2026-10156", ts: 1719765432123 });
  assert.ok(/^[A-Za-z0-9-]+$/.test(id), `unsafe chars in ${id}`);
});

console.log(`\n${passed} passed`);
