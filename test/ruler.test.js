const test = require("node:test");
const assert = require("node:assert");
const Ruler = require("../js/ruler.js");

const spec = {
  marks: [
    { id: "stop", label: "Stop", price: 98, text: "98" },
    { id: "entry", label: "Entry", price: 100, text: "100" },
    { id: "target", label: "Target", price: 106, text: "106" },
  ],
  zones: [
    { from: 98, to: 100, tone: "loss" },
    { from: 100, to: 106, tone: "gain" },
  ],
  ticks: { origin: 100, unit: 2, direction: 1, max: 3 },
};

test("higher prices sit higher on the ruler", () => {
  const L = Ruler.layout(spec);
  const y = Object.fromEntries(L.marks.map((m) => [m.id, m.y]));
  assert.ok(y.target < y.entry && y.entry < y.stop);
  L.marks.forEach((m) => assert.ok(m.y > 0 && m.y < L.height));
});

test("R ticks are counted from entry, and skipped where a mark already sits", () => {
  const L = Ruler.layout(spec);
  // 3R lands exactly on the target at 106, so only 1R and 2R are drawn
  assert.deepStrictEqual(L.ticks.map((t) => t.label), ["1R", "2R"]);
  assert.deepStrictEqual(L.ticks.map((t) => t.price), [102, 104]);
});

test("zones span between their prices", () => {
  const L = Ruler.layout(spec);
  const [loss, gain] = L.zones;
  assert.ok(loss.y1 < loss.y2 && gain.y1 < gain.y2);
  assert.strictEqual(loss.tone, "loss");
  assert.ok(gain.y2 <= loss.y1 + 0.001);
});

test("labels never overlap, even when prices are almost equal", () => {
  const close = {
    marks: [
      { id: "entry", label: "Entry", price: 100, text: "100" },
      { id: "exit", label: "Exit", price: 100.001, text: "100.001" },
      { id: "stop", label: "Stop", price: 100.002, text: "100.002" },
    ],
    zones: [],
    ticks: null,
  };
  const L = Ruler.layout(close);
  const ys = L.marks.map((m) => m.labelY).sort((a, b) => a - b);
  for (let i = 1; i < ys.length; i += 1) assert.ok(ys[i] - ys[i - 1] >= 20 - 1e-9);
  ys.forEach((y) => assert.ok(y >= 28 && y <= L.height - 28));
});

test("identical prices still produce a drawable ruler", () => {
  const flat = {
    marks: [
      { id: "entry", label: "Entry", price: 50, text: "50" },
      { id: "exit", label: "Exit", price: 50, text: "50" },
    ],
    zones: [],
    ticks: null,
  };
  const L = Ruler.layout(flat);
  L.marks.forEach((m) => assert.ok(Number.isFinite(m.y) && Number.isFinite(m.labelY)));
});

test("no ticks without a unit or a count, and never more than six", () => {
  assert.strictEqual(Ruler.layout(Object.assign({}, spec, { ticks: null })).ticks.length, 0);
  assert.strictEqual(Ruler.layout(Object.assign({}, spec, { ticks: { origin: 100, unit: 2, direction: 1, max: 0 } })).ticks.length, 0);
  // six ticks are drawn at most: 102 to 112, minus 106 where the target already sits
  const many = Ruler.layout(Object.assign({}, spec, { ticks: { origin: 100, unit: 2, direction: 1, max: 40 } }));
  assert.deepStrictEqual(many.ticks.map((t) => t.price), [102, 104, 108, 110, 112]);
});

test("a short trade puts ticks below entry", () => {
  const short = Object.assign({}, spec, { ticks: { origin: 100, unit: 2, direction: -1, max: 3 } });
  // 98 is where the stop sits, so only 96 and 94 are drawn
  assert.deepStrictEqual(Ruler.layout(short).ticks.map((t) => t.price), [96, 94]);
});
