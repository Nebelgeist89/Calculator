/*
 * Open for contribution: Trading.averageEntry().
 *
 * 1. Delete the "stub" test below.
 * 2. Remove `skip` from the "spec" tests.
 * 3. Make them pass. See CONTRIBUTING.md for the full description.
 */
const test = require("node:test");
const assert = require("node:assert");
const Trading = require("../js/trading.js");
const Instruments = require("../js/instruments.js");

const unit = Object.assign({}, Instruments.resolve("STOCK_USD"), { pointValue: 1 });
const SKIP = "Open for contribution. See CONTRIBUTING.md";

test("stub: averageEntry is not built yet (delete this test when you build it)", () => {
  assert.throws(() => Trading.averageEntry(), /Not implemented/);
});

test("spec: size-weighted average, total size and break-even", { skip: SKIP }, () => {
  const r = Trading.averageEntry({
    side: "long",
    fills: [{ price: 100, size: 1 }, { price: 98, size: 3 }],
    instrument: unit,
    feePerUnit: 0.1,
  });
  assert.strictEqual(r.size, 4);
  assert.strictEqual(r.averagePrice, 98.5);
  assert.strictEqual(r.breakEvenPrice, 98.6);
  assert.strictEqual(r.stopPrice, null);
});

test("spec: stop that keeps the whole position inside the risk budget", { skip: SKIP }, () => {
  const r = Trading.averageEntry({
    side: "long",
    fills: [{ price: 100, size: 1 }, { price: 98, size: 3 }],
    instrument: unit,
    feePerUnit: 0.1,
    riskBudget: 20,
  });
  assert.strictEqual(r.stopPrice, 93.6);
});

test("spec: shorts mirror longs", { skip: SKIP }, () => {
  const r = Trading.averageEntry({
    side: "short",
    fills: [{ price: 100, size: 1 }, { price: 102, size: 3 }],
    instrument: unit,
    feePerUnit: 0.1,
    riskBudget: 20,
  });
  assert.strictEqual(r.averagePrice, 101.5);
  assert.strictEqual(r.breakEvenPrice, 101.4);
  assert.strictEqual(r.stopPrice, 106.4);
});

test("spec: bad input is explained", { skip: SKIP }, () => {
  const base = { side: "long", fills: [{ price: 100, size: 1 }], instrument: unit };
  assert.throws(() => Trading.averageEntry(Object.assign({}, base, { fills: [] })), /at least one fill/i);
  assert.throws(() => Trading.averageEntry(Object.assign({}, base, { fills: [{ price: 100, size: 0 }] })), /above zero/i);
  assert.throws(() => Trading.averageEntry(Object.assign({}, base, { side: "up" })), /long or short/i);
  assert.throws(() => Trading.averageEntry(Object.assign({}, base, { feePerUnit: 5, riskBudget: 3 })), /larger than the fees/i);
});
