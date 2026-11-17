(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../trading.js"));
  } else {
    (root.CalculatorTools = root.CalculatorTools || []).push(factory(root.Trading));
  }
})(typeof self !== "undefined" ? self : this, function (Trading) {
  "use strict";

  return {
    id: "position-size",
    title: "Position size",
    summary: "How much to buy or sell so that getting stopped out costs what you decided to risk.",
    hasRuler: true,
    fields: [
      { id: "entry", label: "Entry price", kind: "price", default: (i) => i.samplePrice },
      { id: "stop", label: "Stop price", kind: "price", default: (i) => i.samplePrice - i.sampleRisk },
      {
        id: "fee",
        label: (i) => `Fee per ${i.unit}, round trip`,
        kind: "money",
        default: 0,
        optional: true,
        hint: "Brokerage and exchange fees, both ways.",
      },
    ],

    compute(v, desk) {
      const inst = desk.instrument;
      const f = Trading.formatter(inst);
      const r = Trading.positionSize({
        account: desk.account,
        riskPct: desk.riskPct,
        entry: v.entry,
        stop: v.stop,
        instrument: inst,
        feePerUnit: v.fee || 0,
      });
      const sign = r.direction === "long" ? 1 : -1;
      const notes = [];

      if (r.size === 0) {
        notes.push(
          `Your risk budget of ${f.money(r.riskBudget)} is smaller than the cost of one ${inst.unit} ` +
            `(${f.money(r.riskPerUnit)}). Tighten the stop, risk more, or pick a smaller instrument.`
        );
      }

      return {
        headline: { label: "Position size", value: f.size(r.size) },
        sections: [
          {
            rows: [
              { label: "Direction", value: r.direction === "long" ? "Long" : "Short" },
              { label: "Risk budget", value: f.money(r.riskBudget) },
              {
                label: "Stop distance",
                value: `${Trading.num(r.stopDistance, 5)} points, ${Trading.num(r.stopTicks, 1)} ticks`,
              },
              { label: `Risk per ${inst.unit}`, value: f.money(r.riskPerUnit) },
              { label: "Exposure", value: f.money(r.exposure) },
              { label: "Loss if stopped out", value: f.money(r.actualRisk), tone: "loss" },
              { label: "Budget left unused", value: f.money(r.unused), tone: "muted" },
            ],
          },
        ],
        ruler: {
          marks: [
            { id: "stop", label: "Stop", price: v.stop, text: f.price(v.stop) },
            { id: "entry", label: "Entry", price: v.entry, text: f.price(v.entry) },
          ],
          zones: [{ from: v.stop, to: v.entry, tone: "loss" }],
          ticks: { origin: v.entry, unit: r.stopDistance, direction: sign, max: 2 },
          caption: `Each R is ${Trading.num(r.stopDistance, 5)} points, the distance from entry to stop.`,
        },
        notes,
      };
    },
  };
});
