/*
 * Instrument presets.
 *
 * pointValue  money gained or lost per 1.0 of price movement, for one contract, lot or share
 * tickSize    smallest price step
 * lotStep     smallest size you can trade (1 contract, 0.01 lot, ...)
 *
 * WIN and WDO follow B3's published contract specs. The others are common defaults.
 * Brokers differ, so treat every preset as a starting point and edit it on the desk.
 * samplePrice and sampleRisk only seed the input fields; replace them with live prices.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Instruments = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const CURRENCIES = ["BRL", "USD", "EUR", "GBP"];

  const PRESETS = [
    {
      id: "WIN", group: "B3 futures", name: "Mini Ibovespa (WIN)", currency: "BRL",
      unit: "contract", unitPlural: "contracts",
      pointValue: 0.2, tickSize: 5, lotStep: 1, decimals: 0, samplePrice: 130000, sampleRisk: 300,
    },
    {
      id: "WDO", group: "B3 futures", name: "Mini dólar (WDO)", currency: "BRL",
      unit: "contract", unitPlural: "contracts",
      pointValue: 10, tickSize: 0.5, lotStep: 1, decimals: 1, samplePrice: 5400, sampleRisk: 8,
    },
    {
      id: "ES", group: "US futures", name: "E-mini S&P 500 (ES)", currency: "USD",
      unit: "contract", unitPlural: "contracts",
      pointValue: 50, tickSize: 0.25, lotStep: 1, decimals: 2, samplePrice: 6000, sampleRisk: 12,
    },
    {
      id: "MES", group: "US futures", name: "Micro E-mini S&P 500 (MES)", currency: "USD",
      unit: "contract", unitPlural: "contracts",
      pointValue: 5, tickSize: 0.25, lotStep: 1, decimals: 2, samplePrice: 6000, sampleRisk: 12,
    },
    {
      id: "NQ", group: "US futures", name: "E-mini Nasdaq-100 (NQ)", currency: "USD",
      unit: "contract", unitPlural: "contracts",
      pointValue: 20, tickSize: 0.25, lotStep: 1, decimals: 2, samplePrice: 21000, sampleRisk: 60,
    },
    {
      id: "MNQ", group: "US futures", name: "Micro E-mini Nasdaq-100 (MNQ)", currency: "USD",
      unit: "contract", unitPlural: "contracts",
      pointValue: 2, tickSize: 0.25, lotStep: 1, decimals: 2, samplePrice: 21000, sampleRisk: 40,
    },
    {
      id: "EURUSD", group: "Forex and metals", name: "EUR/USD (standard lot)", currency: "USD",
      unit: "lot", unitPlural: "lots",
      pointValue: 100000, tickSize: 0.00001, lotStep: 0.01, decimals: 5, samplePrice: 1.08, sampleRisk: 0.002,
    },
    {
      id: "XAUUSD", group: "Forex and metals", name: "Gold XAU/USD (100 oz lot)", currency: "USD",
      unit: "lot", unitPlural: "lots",
      pointValue: 100, tickSize: 0.01, lotStep: 0.01, decimals: 2, samplePrice: 4000, sampleRisk: 15,
    },
    {
      id: "STOCK_BRL", group: "Stocks and crypto", name: "Stock in BRL", currency: "BRL",
      unit: "share", unitPlural: "shares",
      pointValue: 1, tickSize: 0.01, lotStep: 1, decimals: 2, samplePrice: 30, sampleRisk: 0.6,
    },
    {
      id: "STOCK_USD", group: "Stocks and crypto", name: "Stock or ETF in USD", currency: "USD",
      unit: "share", unitPlural: "shares",
      pointValue: 1, tickSize: 0.01, lotStep: 1, decimals: 2, samplePrice: 100, sampleRisk: 2,
    },
    {
      id: "BTC", group: "Stocks and crypto", name: "Bitcoin spot (BTC/USD)", currency: "USD",
      unit: "BTC", unitPlural: "BTC",
      pointValue: 1, tickSize: 0.01, lotStep: 0.0001, decimals: 2, samplePrice: 90000, sampleRisk: 1500,
    },
    {
      id: "CUSTOM", group: "Other", name: "Custom", currency: "USD",
      unit: "unit", unitPlural: "units",
      pointValue: 1, tickSize: 0.01, lotStep: 1, decimals: 2, samplePrice: 100, sampleRisk: 2,
    },
  ];

  function stepDecimals(step) {
    const text = String(step);
    if (text.includes("e-")) return Number(text.split("e-")[1]);
    const dot = text.indexOf(".");
    return dot === -1 ? 0 : text.length - dot - 1;
  }

  function get(id) {
    return PRESETS.find((preset) => preset.id === id) || null;
  }

  function groups() {
    const byLabel = new Map();
    PRESETS.forEach((preset) => {
      if (!byLabel.has(preset.group)) byLabel.set(preset.group, []);
      byLabel.get(preset.group).push(preset);
    });
    return Array.from(byLabel, ([label, items]) => ({ label, items }));
  }

  /** Preset plus the person's edits, ready to hand to the trading math. */
  function resolve(id, overrides, currency) {
    const preset = get(id) || get("WIN");
    const merged = Object.assign({}, preset, overrides || {});
    if (preset.id === "CUSTOM" && CURRENCIES.includes(currency)) merged.currency = currency;
    merged.decimals = Math.max(preset.decimals, stepDecimals(merged.tickSize));
    merged.edited = Boolean(overrides && Object.keys(overrides).length > 0);
    return merged;
  }

  return { PRESETS, CURRENCIES, get, groups, resolve };
});
