(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../trading.js"));
  } else {
    (root.CalculatorTools = root.CalculatorTools || []).push(factory(root.Trading));
  }
})(typeof self !== "undefined" ? self : this, function (Trading) {
  "use strict";

  const STREAKS = [3, 5, 10, 15, 20];

  return {
    id: "drawdown",
    title: "Drawdown and growth",
    summary: "How far a losing run sets you back, and what compounding does over time.",
    fields: [
      { id: "drawdown", label: "Drawdown to recover from", kind: "percent", default: 20 },
      { id: "growth", label: "Average gain per period", kind: "percent", default: 2 },
      { id: "periods", label: "Number of periods", kind: "number", default: 12, suffix: "periods" },
    ],

    compute(v, desk) {
      const f = Trading.formatter(desk.instrument);
      const recovery = Trading.recoveryGain(v.drawdown);
      const growth = Trading.projectGrowth({ balance: desk.account, ratePct: v.growth, periods: v.periods });
      const growthTone = growth.changePct > 0 ? "gain" : growth.changePct < 0 ? "loss" : "neutral";

      const streaks = STREAKS.map((trades) =>
        Trading.losingStreak({ balance: desk.account, riskPct: desk.riskPct, trades })
      );

      return {
        headline: { label: "Gain needed to recover", value: `+${Trading.pct(recovery, 2)}` },
        sections: [
          {
            rows: [
              { label: `Loss of ${Trading.pct(v.drawdown, 2)} needs a gain of`, value: Trading.pct(recovery, 2) },
              {
                label: `Balance after ${Trading.num(v.periods, 0)} periods`,
                value: f.money(growth.final),
                tone: growthTone,
              },
              { label: "Total change", value: Trading.pct(growth.changePct, 2), tone: growthTone },
            ],
          },
        ],
        table: {
          title: `Losing streaks at ${Trading.pct(desk.riskPct, 2)} risked per trade`,
          columns: ["Losses in a row", "Balance", "Drawdown", "Gain to recover"],
          rows: streaks.map((s) => [
            String(s.trades),
            f.money(s.balance),
            Trading.pct(s.drawdownPct, 2),
            Trading.pct(s.recoveryPct, 2),
          ]),
        },
        notes: [
          "Each loss is a percentage of what is left, so a streak costs a little less each time. The gain needed to recover grows faster than the loss.",
        ],
      };
    },
  };
});
