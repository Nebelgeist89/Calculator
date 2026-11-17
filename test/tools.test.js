const test = require("node:test");
const assert = require("node:assert");
const Trading = require("../js/trading.js");
const Instruments = require("../js/instruments.js");
const Fields = require("../js/fields.js");
const Ruler = require("../js/ruler.js");

Trading.setLocale("en-US");

const tools = [
  require("../js/tools/position-size.js"),
  require("../js/tools/risk-reward.js"),
  require("../js/tools/net-pnl.js"),
  require("../js/tools/expectancy.js"),
  require("../js/tools/drawdown.js"),
  require("../js/tools/levels.js"),
  require("../js/tools/scientific.js"),
  require("../js/tools/scale-plan.js"),
];
const working = tools.filter((tool) => !tool.custom && tool.status !== "open");
const byId = (id) => tools.find((tool) => tool.id === id);

function run(tool, instrumentId, stored) {
  const instrument = Instruments.resolve(instrumentId);
  const { values, missing } = Fields.collect(tool, instrument, stored);
  assert.deepStrictEqual(missing, []);
  return tool.compute(values, { instrument, account: 10000, riskPct: 1 });
}

test("tool ids are unique and every tool is described", () => {
  const ids = tools.map((t) => t.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  tools.forEach((t) => assert.ok(t.title && t.summary, t.id));
});

test("the open tool carries a spec for contributors", () => {
  const open = byId("scale-plan");
  assert.strictEqual(open.status, "open");
  assert.ok(open.spec.length >= 3);
  assert.match(open.specUrl, /CONTRIBUTING\.md$/);
});

test("every working tool runs on its defaults for every preset", () => {
  working.forEach((tool) => {
    Instruments.PRESETS.forEach((preset) => {
      const out = run(tool, preset.id);
      const where = `${tool.id} / ${preset.id}`;
      assert.ok(out.headline.label && out.headline.value, where + " headline");
      (out.sections || []).forEach((section) =>
        section.rows.forEach((row) => {
          assert.strictEqual(typeof row.label, "string", where);
          assert.ok(row.value && !/NaN|undefined|Infinity/.test(row.value) || /∞/.test(row.value), `${where}: ${row.label} = ${row.value}`);
        })
      );
      if (tool.hasRuler) {
        assert.ok(out.ruler, where + " ruler");
        const L = Ruler.layout(out.ruler);
        L.marks.forEach((m) => assert.ok(Number.isFinite(m.y) && Number.isFinite(m.labelY), where));
      }
    });
  });
});

test("default numbers on WIN", () => {
  assert.strictEqual(run(byId("position-size"), "WIN").headline.value, "1 contract");
  assert.strictEqual(run(byId("risk-reward"), "WIN").headline.value, "1 : 2");
  assert.strictEqual(run(byId("net-pnl"), "WIN").headline.value, "R$60.00");
  assert.strictEqual(run(byId("expectancy"), "WIN").headline.value, "0.35R per trade");
  assert.strictEqual(run(byId("drawdown"), "WIN").headline.value, "+25%");
});

test("position size warns when the budget cannot buy one unit", () => {
  const out = run(byId("position-size"), "ES");
  assert.strictEqual(out.headline.value, "0 contracts");
  assert.match(out.notes[0], /smaller than the cost of one contract/);
});

test("risk to reward warns about a poor payoff", () => {
  const stored = { entry: "100", stop: "98", target: "101", size: "" };
  const out = run(byId("risk-reward"), "STOCK_USD", stored);
  assert.strictEqual(out.headline.value, "1 : 0.5");
  assert.match(out.notes[0], /break even/);
  // empty size means no money rows
  assert.ok(!out.sections[0].rows.some((row) => row.label === "Money at risk"));
});

test("tools report bad input in plain words", () => {
  const tool = byId("risk-reward");
  const instrument = Instruments.resolve("WIN");
  const { values } = Fields.collect(tool, instrument, { entry: "100", stop: "100", target: "110" });
  assert.throws(() => tool.compute(values, { instrument, account: 10000, riskPct: 1 }), /differ/);
});

test("the scale-in tool is a stub until someone builds it", () => {
  assert.throws(() => byId("scale-plan").compute(), /CONTRIBUTING/);
});
