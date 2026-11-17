(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../trading.js"));
  } else {
    (root.CalculatorTools = root.CalculatorTools || []).push(factory(root.Trading));
  }
})(typeof self !== "undefined" ? self : this, function (Trading) {
  "use strict";

  return {
    id: "levels",
    title: "Pivots and Fibonacci",
    summary: "Support and resistance levels from the last session's range, and retracements from a swing.",
    fields: [
      { id: "high", label: "High", kind: "price", default: (i) => i.samplePrice + 2 * i.sampleRisk },
      { id: "low", label: "Low", kind: "price", default: (i) => i.samplePrice - 2 * i.sampleRisk },
      { id: "close", label: "Close", kind: "price", default: (i) => i.samplePrice + 0.5 * i.sampleRisk },
      {
        id: "swing",
        label: "Swing direction",
        kind: "select",
        default: "up",
        options: [
          { value: "up", label: "Up, low to high" },
          { value: "down", label: "Down, high to low" },
        ],
      },
    ],

    compute(v, desk) {
      const f = Trading.formatter(desk.instrument);
      const p = Trading.pivots({ high: v.high, low: v.low, close: v.close });
      const fib = Trading.fibonacci({ high: v.high, low: v.low, swing: v.swing });
      const ratioLabel = (ratio) => `${Trading.num(ratio * 100, 1)}%`;

      return {
        headline: { label: "Pivot point", value: f.price(p.P) },
        sections: [
          {
            title: "Pivot points, from high, low and close",
            rows: ["R3", "R2", "R1", "P", "S1", "S2", "S3"].map((key) => ({
              label: key === "P" ? "Pivot" : key,
              value: f.price(p[key]),
              tone: key === "P" ? "neutral" : undefined,
            })),
          },
          {
            title: v.swing === "up" ? "Retracements back from the high" : "Retracements back up from the low",
            rows: fib.retracements.map((level) => ({ label: ratioLabel(level.ratio), value: f.price(level.price) })),
          },
          {
            title: "Extensions of the same range",
            rows: fib.extensions.map((level) => ({ label: ratioLabel(level.ratio), value: f.price(level.price) })),
          },
        ],
        notes: [],
      };
    },
  };
});
