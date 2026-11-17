const test = require("node:test");
const assert = require("node:assert");
const Fields = require("../js/fields.js");
const Instruments = require("../js/instruments.js");

const win = Instruments.resolve("WIN");
const tool = {
  fields: [
    { id: "entry", label: "Entry price", kind: "price", default: (i) => i.samplePrice },
    { id: "fee", label: (i) => `Fee per ${i.unit}`, kind: "money", default: 0, optional: true },
    { id: "side", label: "Side", kind: "select", default: "long", options: [] },
  ],
};

test("defaults come from the instrument", () => {
  assert.strictEqual(Fields.defaultValue(tool.fields[0], win), 130000);
  assert.strictEqual(Fields.label(tool.fields[1], win), "Fee per contract");
});

test("collect uses stored text, then defaults", () => {
  const { values, missing } = Fields.collect(tool, win, { entry: "131000" });
  assert.strictEqual(values.entry, 131000);
  assert.strictEqual(values.fee, 0);
  assert.strictEqual(values.side, "long");
  assert.deepStrictEqual(missing, []);
});

test("an emptied required field is reported by label, an optional one is not", () => {
  const { values, missing } = Fields.collect(tool, win, { entry: "", fee: "" });
  assert.ok(Number.isNaN(values.entry));
  assert.ok(Number.isNaN(values.fee));
  assert.deepStrictEqual(missing, ["Entry price"]);
});

test("suffix shows the unit that fits the field", () => {
  assert.strictEqual(Fields.suffix({ kind: "money" }, win), "BRL");
  assert.strictEqual(Fields.suffix({ kind: "percent" }, win), "%");
  assert.strictEqual(Fields.suffix({ kind: "size" }, win), "contracts");
  assert.strictEqual(Fields.suffix({ kind: "ticks" }, win), "ticks");
  assert.strictEqual(Fields.suffix({ kind: "number", suffix: "periods" }, win), "periods");
  assert.strictEqual(Fields.suffix({ kind: "price" }, win), "");
});
