(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../trading.js"));
  } else {
    (root.CalculatorTools = root.CalculatorTools || []).push(factory(root.Trading));
  }
})(typeof self !== "undefined" ? self : this, function (Trading) {
  "use strict";

  return {
    id: "expectancy",
    title: "Expectancy and Kelly",
    summary: "What the average trade is worth, from your win rate and your average win and loss.",
    fields: [
      { id: "winRate", label: "Win rate", kind: "percent", default: 45 },
      {
        id: "avgWin",
        label: "Average win",
        kind: "number",
        default: 2,
        hint: "Money or R multiples. Use the same unit as the average loss.",
      },
      { id: "avgLoss", label: "Average loss", kind: "number", default: 1 },
    ],

    compute(v) {
      const r = Trading.expectancy({ winRatePct: v.winRate, avgWin: v.avgWin, avgLoss: v.avgLoss });
      const tone = r.perTradeR > 0 ? "gain" : r.perTradeR < 0 ? "loss" : "neutral";
      const notes = [];

      if (r.hasEdge) {
        notes.push(
          "Kelly assumes your win rate and averages are exact. Real estimates are noisy, so most traders risk a fraction of it."
        );
      } else {
        notes.push("At these numbers the average trade loses money, so the Kelly fraction is zero.");
      }

      return {
        headline: { label: "Expectancy", value: `${Trading.num(r.perTradeR, 2)}R per trade`, tone },
        sections: [
          {
            rows: [
              { label: "Reward to risk", value: `1 : ${Trading.num(r.payoff, 2)}` },
              { label: "Break-even win rate", value: Trading.pct(r.breakEvenWinRate, 1) },
              { label: "Expectancy per trade", value: `${Trading.num(r.perTradeR, 2)}R`, tone },
              { label: "Profit factor", value: Trading.num(r.profitFactor, 2) },
              { label: "Kelly fraction", value: Trading.pct(r.kellyPct, 1) },
              { label: "Half Kelly", value: Trading.pct(r.halfKellyPct, 1) },
            ],
          },
        ],
        notes,
      };
    },
  };
});
