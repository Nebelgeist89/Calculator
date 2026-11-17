(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../trading.js"));
  } else {
    (root.CalculatorTools = root.CalculatorTools || []).push(factory(root.Trading));
  }
})(typeof self !== "undefined" ? self : this, function (Trading) {
  "use strict";

  return {
    id: "net-pnl",
    title: "Net result",
    summary: "What a trade really made after fees and slippage.",
    hasRuler: true,
    fields: [
      {
        id: "side",
        label: "Side",
        kind: "select",
        default: "long",
        options: [
          { value: "long", label: "Long" },
          { value: "short", label: "Short" },
        ],
      },
      { id: "entry", label: "Entry price", kind: "price", default: (i) => i.samplePrice },
      { id: "exit", label: "Exit price", kind: "price", default: (i) => i.samplePrice + i.sampleRisk },
      { id: "size", label: (i) => `Size in ${i.unitPlural}`, kind: "size", default: 1 },
      {
        id: "fee",
        label: (i) => `Fee per ${i.unit}, round trip`,
        kind: "money",
        default: 0,
        optional: true,
        hint: "Brokerage and exchange fees, both ways.",
      },
      {
        id: "slippage",
        label: "Slippage",
        kind: "ticks",
        default: 0,
        optional: true,
        hint: "Ticks lost across entry and exit, in total.",
      },
    ],

    compute(v, desk) {
      const inst = desk.instrument;
      const f = Trading.formatter(inst);
      const r = Trading.netPnl({
        side: v.side,
        entry: v.entry,
        exit: v.exit,
        size: v.size,
        instrument: inst,
        feePerUnit: v.fee || 0,
        slippageTicks: v.slippage || 0,
        account: desk.account,
      });
      const tone = r.net > 0 ? "gain" : r.net < 0 ? "loss" : "neutral";
      const moveTone = r.points > 0 ? "gain" : r.points < 0 ? "loss" : "neutral";

      const rows = [
        { label: "Price move in your favor", value: `${Trading.num(r.points, 5)} points`, tone: moveTone },
        { label: "Gross result", value: f.money(r.gross), tone: moveTone },
        { label: "Fees", value: f.money(r.fees), tone: r.fees > 0 ? "loss" : "muted" },
        { label: "Slippage", value: f.money(r.slippage), tone: r.slippage > 0 ? "loss" : "muted" },
        { label: "Net result", value: f.money(r.net), tone },
        { label: "Net points per unit", value: Trading.num(r.netPoints, 5), tone },
      ];
      if (r.returnPct !== null) {
        rows.push({ label: "Return on account", value: Trading.pct(r.returnPct, 2), tone });
      }

      return {
        headline: { label: "Net result", value: f.money(r.net), tone },
        sections: [{ rows }],
        ruler: {
          marks: [
            { id: "entry", label: "Entry", price: v.entry, text: f.price(v.entry) },
            { id: "exit", label: "Exit", price: v.exit, text: f.price(v.exit) },
          ],
          zones: [{ from: v.entry, to: v.exit, tone: r.points > 0 ? "gain" : "loss" }],
          ticks: null,
          caption: `${v.side === "long" ? "Long" : "Short"} from ${f.price(v.entry)} to ${f.price(v.exit)}.`,
        },
        notes: [],
      };
    },
  };
});
