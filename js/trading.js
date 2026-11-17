/*
 * Trading math. Pure functions with no DOM, so they run in the browser and in Node.
 *
 * Every calculation takes plain numbers and an instrument (see instruments.js)
 * and throws an Error with a sentence a person can act on when the inputs don't work.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Trading = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---------- helpers ----------

  const clean = (value) => Number(value.toPrecision(12));

  function stepDecimals(step) {
    const text = String(step);
    if (text.includes("e-")) return Number(text.split("e-")[1]);
    const dot = text.indexOf(".");
    return dot === -1 ? 0 : text.length - dot - 1;
  }

  function roundDownToStep(value, step) {
    const steps = Math.floor(value / step + 1e-9);
    return Number((steps * step).toFixed(stepDecimals(step)));
  }

  function requireNumber(value, name) {
    if (!Number.isFinite(value)) throw new Error("Enter " + name + ".");
  }

  function requirePositive(value, name) {
    if (!Number.isFinite(value) || value <= 0) throw new Error(name + " must be greater than zero.");
  }

  function requireInstrument(instrument) {
    requirePositive(instrument.pointValue, "Point value");
    requirePositive(instrument.tickSize, "Tick size");
    requirePositive(instrument.lotStep, "Smallest size");
  }

  function directionOf(entry, stop) {
    if (entry === stop) throw new Error("Stop must differ from entry.");
    return entry > stop ? "long" : "short";
  }

  // ---------- position sizing ----------

  /**
   * How many contracts, lots or shares keep the loss at a stop-out within the risk budget.
   * feePerUnit is the round-trip cost of one unit and counts as part of the risk.
   */
  function positionSize(input) {
    const { account, riskPct, entry, stop, instrument } = input;
    const fee = input.feePerUnit || 0;

    requireInstrument(instrument);
    requirePositive(account, "Account");
    requirePositive(riskPct, "Risk per trade");
    if (riskPct > 100) throw new Error("Risk per trade can't be above 100%.");
    requireNumber(entry, "an entry price");
    requireNumber(stop, "a stop price");
    if (fee < 0) throw new Error("Fees can't be negative.");

    const direction = directionOf(entry, stop);
    const stopDistance = clean(Math.abs(entry - stop));
    const riskBudget = clean((account * riskPct) / 100);
    const riskPerUnit = clean(stopDistance * instrument.pointValue + fee);
    const size = roundDownToStep(riskBudget / riskPerUnit, instrument.lotStep);
    const actualRisk = clean(size * riskPerUnit);

    return {
      direction,
      stopDistance,
      stopTicks: clean(stopDistance / instrument.tickSize),
      riskBudget,
      riskPerUnit,
      size,
      actualRisk,
      unused: clean(riskBudget - actualRisk),
      exposure: clean(size * entry * instrument.pointValue),
    };
  }

  // ---------- risk and reward ----------

  function riskReward({ entry, stop, target, instrument, size }) {
    requireInstrument(instrument);
    requireNumber(entry, "an entry price");
    requireNumber(stop, "a stop price");
    requireNumber(target, "a target price");

    const direction = directionOf(entry, stop);
    if (direction === "long" && target <= entry) throw new Error("For a long, the target must be above entry.");
    if (direction === "short" && target >= entry) throw new Error("For a short, the target must be below entry.");

    const risk = Math.abs(entry - stop);
    const reward = Math.abs(target - entry);
    const ratio = reward / risk;
    const sign = direction === "long" ? 1 : -1;
    const units = Number.isFinite(size) && size > 0 ? size : 0;

    return {
      direction,
      risk: clean(risk),
      reward: clean(reward),
      ratio: clean(ratio),
      breakEvenWinRate: clean(100 / (1 + ratio)),
      levels: [1, 2, 3].map((multiple) => ({ multiple, price: clean(entry + sign * multiple * risk) })),
      units,
      riskMoney: clean(risk * instrument.pointValue * units),
      rewardMoney: clean(reward * instrument.pointValue * units),
    };
  }

  // ---------- result of a closed trade ----------

  function netPnl({ side, entry, exit, size, instrument, feePerUnit, slippageTicks, account }) {
    const fee = feePerUnit || 0;
    const slip = slippageTicks || 0;

    requireInstrument(instrument);
    if (side !== "long" && side !== "short") throw new Error("Choose long or short.");
    requireNumber(entry, "an entry price");
    requireNumber(exit, "an exit price");
    requirePositive(size, "Size");
    if (fee < 0) throw new Error("Fees can't be negative.");
    if (slip < 0) throw new Error("Slippage can't be negative.");

    const points = clean(side === "long" ? exit - entry : entry - exit);
    const gross = clean(points * instrument.pointValue * size);
    const fees = clean(fee * size);
    const slippage = clean(slip * instrument.tickSize * instrument.pointValue * size);
    const net = clean(gross - fees - slippage);

    return {
      points,
      gross,
      fees,
      slippage,
      net,
      netPoints: clean(net / (instrument.pointValue * size)),
      returnPct: account > 0 ? clean((net / account) * 100) : null,
    };
  }

  // ---------- edge ----------

  /**
   * winRatePct in percent; avgWin and avgLoss as positive numbers in the same unit
   * (money, points or R multiples).
   */
  function expectancy({ winRatePct, avgWin, avgLoss }) {
    if (!(winRatePct >= 0 && winRatePct <= 100)) throw new Error("Win rate must be between 0% and 100%.");
    requirePositive(avgWin, "Average win");
    requirePositive(avgLoss, "Average loss");

    const wins = winRatePct / 100;
    const payoff = avgWin / avgLoss;
    const perTrade = wins * avgWin - (1 - wins) * avgLoss;
    const kelly = Math.max(0, wins - (1 - wins) / payoff);

    return {
      payoff: clean(payoff),
      perTrade: clean(perTrade),
      perTradeR: clean(perTrade / avgLoss),
      profitFactor: wins === 1 ? Infinity : clean((wins * avgWin) / ((1 - wins) * avgLoss)),
      breakEvenWinRate: clean((100 * avgLoss) / (avgWin + avgLoss)),
      kellyPct: clean(kelly * 100),
      halfKellyPct: clean(kelly * 50),
      hasEdge: perTrade > 0,
    };
  }

  // ---------- drawdown and growth ----------

  /** Gain, in percent, needed to get back to even after losing drawdownPct. */
  function recoveryGain(drawdownPct) {
    if (!(drawdownPct >= 0 && drawdownPct < 100)) throw new Error("Drawdown must be at least 0% and below 100%.");
    return clean((1 / (1 - drawdownPct / 100) - 1) * 100);
  }

  /** Balance after `trades` losses in a row, each risking riskPct of the current balance. */
  function losingStreak({ balance, riskPct, trades }) {
    requirePositive(balance, "Account");
    requirePositive(riskPct, "Risk per trade");
    if (riskPct >= 100) throw new Error("Risk per trade must be below 100% to compare streaks.");
    const factor = Math.pow(1 - riskPct / 100, trades);
    const drawdownPct = clean((1 - factor) * 100);
    return { trades, balance: clean(balance * factor), drawdownPct, recoveryPct: recoveryGain(drawdownPct) };
  }

  function projectGrowth({ balance, ratePct, periods }) {
    requirePositive(balance, "Account");
    requireNumber(ratePct, "an average gain per period");
    if (!(ratePct > -100)) throw new Error("Average gain must be above -100%.");
    if (!Number.isInteger(periods) || periods < 0 || periods > 1000) {
      throw new Error("Periods must be a whole number from 0 to 1000.");
    }
    const final = clean(balance * Math.pow(1 + ratePct / 100, periods));
    return { final, changePct: clean((final / balance - 1) * 100) };
  }

  // ---------- price levels ----------

  function pivots({ high, low, close }) {
    requireNumber(high, "a high");
    requireNumber(low, "a low");
    requireNumber(close, "a close");
    if (high < low) throw new Error("High can't be below low.");

    const p = (high + low + close) / 3;
    const range = high - low;
    const levels = {
      R3: high + 2 * (p - low),
      R2: p + range,
      R1: 2 * p - low,
      P: p,
      S1: 2 * p - high,
      S2: p - range,
      S3: low - 2 * (high - p),
    };
    Object.keys(levels).forEach((key) => (levels[key] = clean(levels[key])));
    return levels;
  }

  const RETRACEMENTS = [0.236, 0.382, 0.5, 0.618, 0.786];
  const EXTENSIONS = [1.272, 1.618, 2];

  /**
   * swing "up": the move ran from low to high. Retracements fall back from the high;
   * extensions project the same range up from the low.
   * swing "down" mirrors that.
   */
  function fibonacci({ high, low, swing }) {
    requireNumber(high, "a high");
    requireNumber(low, "a low");
    if (!(high > low)) throw new Error("High must be above low.");
    if (swing !== "up" && swing !== "down") throw new Error("Choose the swing direction.");

    const range = high - low;
    const up = swing === "up";
    return {
      retracements: RETRACEMENTS.map((ratio) => ({
        ratio,
        price: clean(up ? high - range * ratio : low + range * ratio),
      })),
      extensions: EXTENSIONS.map((ratio) => ({
        ratio,
        price: clean(up ? low + range * ratio : high - range * ratio),
      })),
    };
  }

  // ---------- open for contribution ----------

  /**
   * OPEN FOR CONTRIBUTION. See CONTRIBUTING.md for the spec.
   * Average entry price, total size and break-even across several fills.
   */
  function averageEntry() {
    throw new Error("Not implemented yet. See CONTRIBUTING.md.");
  }

  // ---------- formatting ----------

  let locale; // undefined means the browser's own locale

  function setLocale(value) {
    locale = value;
  }

  function num(value, digits) {
    if (value === Infinity) return "∞";
    const max = digits === undefined ? 2 : digits;
    return new Intl.NumberFormat(locale, { maximumFractionDigits: max }).format(value);
  }

  function fixed(value, digits) {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  }

  function money(value, currency) {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
  }

  function pct(value, digits) {
    return num(value, digits === undefined ? 2 : digits) + "%";
  }

  /** Formatting helpers bound to one instrument. */
  function formatter(instrument) {
    return {
      num,
      pct,
      money: (value) => money(value, instrument.currency),
      price: (value) => fixed(value, instrument.decimals),
      size: (value) =>
        num(value, stepDecimals(instrument.lotStep)) + " " + (value === 1 ? instrument.unit : instrument.unitPlural),
    };
  }

  return {
    positionSize,
    riskReward,
    netPnl,
    expectancy,
    recoveryGain,
    losingStreak,
    projectGrowth,
    pivots,
    fibonacci,
    averageEntry,
    roundDownToStep,
    stepDecimals,
    setLocale,
    num,
    pct,
    money,
    fixed,
    formatter,
  };
});
