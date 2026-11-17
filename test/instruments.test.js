const test = require("node:test");
const assert = require("node:assert");
const Instruments = require("../js/instruments.js");

const tickValue = (id) => {
  const i = Instruments.get(id);
  return Number((i.tickSize * i.pointValue).toPrecision(12));
};

test("B3 presets match the published contract specs", () => {
  // WIN: R$ 0.20 per index point, tick of 5 points
  assert.strictEqual(Instruments.get("WIN").pointValue, 0.2);
  assert.strictEqual(Instruments.get("WIN").tickSize, 5);
  assert.strictEqual(tickValue("WIN"), 1);
  // WDO: US$ 10,000 contract quoted per US$ 1,000, tick of R$ 0.50 per 1,000 = R$ 5.00
  assert.strictEqual(Instruments.get("WDO").pointValue, 10);
  assert.strictEqual(Instruments.get("WDO").tickSize, 0.5);
  assert.strictEqual(tickValue("WDO"), 5);
});

test("other presets have the expected tick values", () => {
  assert.strictEqual(tickValue("ES"), 12.5);
  assert.strictEqual(tickValue("MES"), 1.25);
  assert.strictEqual(tickValue("NQ"), 5);
  assert.strictEqual(tickValue("MNQ"), 0.5);
  assert.strictEqual(tickValue("EURUSD"), 1);
});

test("every preset is complete and ids are unique", () => {
  const ids = new Set();
  Instruments.PRESETS.forEach((p) => {
    assert.ok(!ids.has(p.id), "duplicate id " + p.id);
    ids.add(p.id);
    ["pointValue", "tickSize", "lotStep", "samplePrice", "sampleRisk"].forEach((key) =>
      assert.ok(p[key] > 0, `${p.id}.${key} must be positive`)
    );
    assert.ok(Instruments.CURRENCIES.includes(p.currency), p.id + " currency");
    assert.ok(p.unit && p.unitPlural && p.group && p.name, p.id + " labels");
    assert.ok(p.sampleRisk < p.samplePrice, p.id + " sample stop must stay above zero");
  });
});

test("groups keep presets together", () => {
  const groups = Instruments.groups();
  assert.strictEqual(groups[0].label, "B3 futures");
  assert.strictEqual(groups.reduce((n, g) => n + g.items.length, 0), Instruments.PRESETS.length);
});

test("resolve applies edits without touching the preset", () => {
  const plain = Instruments.resolve("WIN");
  assert.strictEqual(plain.edited, false);

  const edited = Instruments.resolve("WIN", { pointValue: 0.25 });
  assert.strictEqual(edited.pointValue, 0.25);
  assert.strictEqual(edited.edited, true);
  assert.strictEqual(Instruments.get("WIN").pointValue, 0.2);
});

test("decimals follow the tick size", () => {
  assert.strictEqual(Instruments.resolve("EURUSD").decimals, 5);
  assert.strictEqual(Instruments.resolve("WIN").decimals, 0);
  assert.strictEqual(Instruments.resolve("WIN", { tickSize: 0.005 }).decimals, 3);
});

test("only the custom instrument takes a currency", () => {
  assert.strictEqual(Instruments.resolve("CUSTOM", null, "EUR").currency, "EUR");
  assert.strictEqual(Instruments.resolve("WIN", null, "EUR").currency, "BRL");
  assert.strictEqual(Instruments.resolve("NOPE").id, "WIN");
});
