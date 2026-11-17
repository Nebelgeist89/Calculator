(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../trading.js"));
  } else {
    (root.CalculatorTools = root.CalculatorTools || []).push(factory(root.Trading));
  }
})(typeof self !== "undefined" ? self : this, function (Trading) {
  "use strict";

  return {
    id: "risk-reward",
    title: "Risk to reward",
    summary: "What the trade pays for what it risks, and how often you need to win to break even.",
    hasRuler: true,
    fields: [
      { id: "entry", label: "Entry price", kind: "price", default: (i) => i.samplePrice },
      { id: "stop", label: "Stop price", kind: "price", default: (i) => i.samplePrice - i.sampleRisk },
      { id: "target", label: "Target price", kind: "price", default: (i) => i.samplePrice + 2 * i.sampleRisk },
      {
        id: "size",
        label: (i) => `Size in ${i.unitPlural}`,
        kind: "size",
        default: 1,
        optional: true,
        hint: "Leave empty to skip the money rows.",
      },
    ],

    compute(v, desk) {
      const inst = desk.instrument;
      const f = Trading.formatter(inst);
      const r = Trading.riskReward({
        entry: v.entry,
        stop: v.stop,
        target: v.target,
        instrument: inst,
        size: v.size,
      });
      const sign = r.direction === "long" ? 1 : -1;
      const notes = [];

      const rows = [
        { label: "Direction", value: r.direction === "long" ? "Long" : "Short" },
        { label: "Risk", value: `${Trading.num(r.risk, 5)} points` },
        { label: "Reward", value: `${Trading.num(r.reward, 5)} points` },
        { label: "Break-even win rate, before fees", value: Trading.pct(r.breakEvenWinRate, 1) },
      ];
      if (r.units > 0) {
        rows.push({ label: "Money at risk", value: f.money(r.riskMoney), tone: "loss" });
        rows.push({ label: "Money to gain", value: f.money(r.rewardMoney), tone: "gain" });
      }

      if (r.ratio < 1) {
        notes.push(
          `The target pays less than the stop risks, so you would need to win more than ${Trading.pct(
            r.breakEvenWinRate,
            0
          )} of these trades just to break even.`
        );
      }

      return {
        headline: { label: "Risk to reward", value: `1 : ${Trading.num(r.ratio, 2)}` },
        sections: [
          { rows },
          {
            title: "Targets by multiple of risk",
            rows: r.levels.map((level) => ({ label: `${level.multiple}R`, value: f.price(level.price) })),
          },
        ],
        ruler: {
          marks: [
            { id: "stop", label: "Stop", price: v.stop, text: f.price(v.stop) },
            { id: "entry", label: "Entry", price: v.entry, text: f.price(v.entry) },
            { id: "target", label: "Target", price: v.target, text: f.price(v.target) },
          ],
          zones: [
            { from: v.stop, to: v.entry, tone: "loss" },
            { from: v.entry, to: v.target, tone: "gain" },
          ],
          ticks: { origin: v.entry, unit: r.risk, direction: sign, max: Math.floor(r.ratio) },
          caption: `Each R is ${Trading.num(r.risk, 5)} points. The target sits at ${Trading.num(r.ratio, 2)}R.`,
        },
        notes,
      };
    },
  };
});
