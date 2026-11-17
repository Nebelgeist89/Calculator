const test = require("node:test");
const assert = require("node:assert");
const Trading = require("../js/trading.js");
const Instruments = require("../js/instruments.js");

Trading.setLocale("en-US");

const near = (actual, expected, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} is not close to ${expected}`);
const win = Instruments.resolve("WIN");
const stock = Object.assign({}, Instruments.resolve("STOCK_USD"));

test("position size: WIN long", () => {
  const r = Trading.positionSize({ account: 10000, riskPct: 1, entry: 130000, stop: 129700, instrument: win });
  assert.strictEqual(r.direction, "long");
  assert.strictEqual(r.riskBudget, 100);
  assert.strictEqual(r.stopDistance, 300);
  assert.strictEqual(r.stopTicks, 60);
  assert.strictEqual(r.riskPerUnit, 60);
  assert.strictEqual(r.size, 1);
  assert.strictEqual(r.actualRisk, 60);
  assert.strictEqual(r.unused, 40);
  assert.strictEqual(r.exposure, 26000);
});

test("position size: bigger account, fees count as risk", () => {
  const base = { account: 50000, riskPct: 1, entry: 130000, stop: 129700, instrument: win };
  assert.strictEqual(Trading.positionSize(base).size, 8);
  const withFee = Trading.positionSize(Object.assign({ feePerUnit: 2.5 }, base));
  assert.strictEqual(withFee.riskPerUnit, 62.5);
  assert.strictEqual(withFee.size, 8);
  assert.strictEqual(withFee.actualRisk, 500);
});

test("position size: short, and a budget too small for one unit", () => {
  const short = Trading.positionSize({ account: 10000, riskPct: 1, entry: 129700, stop: 130000, instrument: win });
  assert.strictEqual(short.direction, "short");

  const es = Instruments.resolve("ES");
  const tooSmall = Trading.positionSize({ account: 10000, riskPct: 1, entry: 6000, stop: 5988, instrument: es });
  assert.strictEqual(tooSmall.size, 0);
  assert.strictEqual(tooSmall.actualRisk, 0);
});

test("position size: fractional lots round down without float drift", () => {
  const eur = Instruments.resolve("EURUSD");
  const r = Trading.positionSize({ account: 10000, riskPct: 1, entry: 1.08, stop: 1.078, instrument: eur });
  assert.strictEqual(r.stopDistance, 0.002);
  assert.strictEqual(r.stopTicks, 200);
  assert.strictEqual(r.size, 0.5);
  assert.strictEqual(Trading.roundDownToStep(0.29, 0.01), 0.29);
});

test("position size: bad input is explained", () => {
  const ok = { account: 10000, riskPct: 1, entry: 100, stop: 98, instrument: stock };
  const fails = (patch, pattern) => assert.throws(() => Trading.positionSize(Object.assign({}, ok, patch)), pattern);
  fails({ stop: 100 }, /differ/i);
  fails({ riskPct: 0 }, /greater than zero/i);
  fails({ riskPct: 101 }, /100%/);
  fails({ account: -5 }, /Account/);
  fails({ entry: NaN }, /entry/i);
  fails({ feePerUnit: -1 }, /negative/i);
  fails({ instrument: Object.assign({}, stock, { pointValue: 0 }) }, /Point value/);
});

test("risk to reward: long and short", () => {
  const inst = Object.assign({}, stock, { pointValue: 1 });
  const long = Trading.riskReward({ entry: 100, stop: 98, target: 106, instrument: inst, size: 10 });
  assert.strictEqual(long.ratio, 3);
  assert.strictEqual(long.breakEvenWinRate, 25);
  assert.deepStrictEqual(long.levels.map((l) => l.price), [102, 104, 106]);
  assert.strictEqual(long.riskMoney, 20);
  assert.strictEqual(long.rewardMoney, 60);

  const short = Trading.riskReward({ entry: 100, stop: 102, target: 94, instrument: inst });
  assert.strictEqual(short.direction, "short");
  assert.strictEqual(short.ratio, 3);
  assert.deepStrictEqual(short.levels.map((l) => l.price), [98, 96, 94]);
  assert.strictEqual(short.units, 0);
});

test("risk to reward: target on the wrong side", () => {
  const inst = stock;
  assert.throws(() => Trading.riskReward({ entry: 100, stop: 98, target: 99, instrument: inst }), /above entry/);
  assert.throws(() => Trading.riskReward({ entry: 100, stop: 102, target: 101, instrument: inst }), /below entry/);
  assert.throws(() => Trading.riskReward({ entry: 100, stop: 100, target: 101, instrument: inst }), /differ/);
});

test("net result: long with fees and slippage", () => {
  const r = Trading.netPnl({
    side: "long", entry: 130000, exit: 130300, size: 2, instrument: win,
    feePerUnit: 2.5, slippageTicks: 1, account: 10000,
  });
  assert.strictEqual(r.points, 300);
  assert.strictEqual(r.gross, 120);
  assert.strictEqual(r.fees, 5);
  assert.strictEqual(r.slippage, 2);
  assert.strictEqual(r.net, 113);
  assert.strictEqual(r.netPoints, 282.5);
  assert.strictEqual(r.returnPct, 1.13);
});

test("net result: short, losing trade, errors", () => {
  const gain = Trading.netPnl({ side: "short", entry: 130000, exit: 129800, size: 1, instrument: win });
  assert.strictEqual(gain.gross, 40);
  const loss = Trading.netPnl({ side: "long", entry: 130000, exit: 129900, size: 1, instrument: win });
  assert.strictEqual(loss.net, -20);
  assert.throws(() => Trading.netPnl({ side: "up", entry: 1, exit: 2, size: 1, instrument: win }), /long or short/);
  assert.throws(() => Trading.netPnl({ side: "long", entry: 1, exit: 2, size: 0, instrument: win }), /Size/);
});

test("expectancy and Kelly", () => {
  const r = Trading.expectancy({ winRatePct: 45, avgWin: 2, avgLoss: 1 });
  near(r.payoff, 2);
  near(r.perTrade, 0.35);
  near(r.perTradeR, 0.35);
  near(r.profitFactor, 0.9 / 0.55);
  near(r.breakEvenWinRate, 100 / 3);
  near(r.kellyPct, 17.5);
  near(r.halfKellyPct, 8.75);
  assert.strictEqual(r.hasEdge, true);

  const losing = Trading.expectancy({ winRatePct: 30, avgWin: 1, avgLoss: 1 });
  near(losing.perTrade, -0.4);
  assert.strictEqual(losing.kellyPct, 0);
  assert.strictEqual(losing.hasEdge, false);

  assert.strictEqual(Trading.expectancy({ winRatePct: 100, avgWin: 1, avgLoss: 1 }).profitFactor, Infinity);
  assert.throws(() => Trading.expectancy({ winRatePct: 101, avgWin: 1, avgLoss: 1 }), /between/);
  assert.throws(() => Trading.expectancy({ winRatePct: 50, avgWin: 0, avgLoss: 1 }), /Average win/);
});

test("recovery, losing streaks and growth", () => {
  assert.strictEqual(Trading.recoveryGain(20), 25);
  assert.strictEqual(Trading.recoveryGain(50), 100);
  assert.strictEqual(Trading.recoveryGain(0), 0);
  assert.throws(() => Trading.recoveryGain(100), /below 100/);
  assert.throws(() => Trading.recoveryGain(-1), /at least 0/);

  const streak = Trading.losingStreak({ balance: 10000, riskPct: 1, trades: 3 });
  near(streak.balance, 9702.99, 1e-6);
  near(streak.drawdownPct, 2.9701, 1e-6);
  near(streak.recoveryPct, (1 / 0.970299 - 1) * 100, 1e-6);

  assert.strictEqual(Trading.projectGrowth({ balance: 1000, ratePct: 10, periods: 2 }).final, 1210);
  assert.strictEqual(Trading.projectGrowth({ balance: 1000, ratePct: -50, periods: 1 }).final, 500);
  assert.throws(() => Trading.projectGrowth({ balance: 1000, ratePct: 1, periods: 1.5 }), /whole number/);
});

test("pivot points", () => {
  assert.deepStrictEqual(Trading.pivots({ high: 110, low: 90, close: 100 }), {
    R3: 130, R2: 120, R1: 110, P: 100, S1: 90, S2: 80, S3: 70,
  });
  assert.throws(() => Trading.pivots({ high: 90, low: 110, close: 100 }), /below low/);
});

test("fibonacci levels", () => {
  const up = Trading.fibonacci({ high: 200, low: 100, swing: "up" });
  assert.deepStrictEqual(up.retracements.map((l) => l.price), [176.4, 161.8, 150, 138.2, 121.4]);
  assert.deepStrictEqual(up.extensions.map((l) => l.price), [227.2, 261.8, 300]);

  const down = Trading.fibonacci({ high: 200, low: 100, swing: "down" });
  assert.deepStrictEqual(down.retracements.map((l) => l.price), [123.6, 138.2, 150, 161.8, 178.6]);
  assert.deepStrictEqual(down.extensions.map((l) => l.price), [72.8, 38.2, 0]);

  assert.throws(() => Trading.fibonacci({ high: 100, low: 100, swing: "up" }), /above low/);
  assert.throws(() => Trading.fibonacci({ high: 200, low: 100, swing: "sideways" }), /direction/);
});

test("formatting", () => {
  assert.strictEqual(Trading.money(1234.5, "USD"), "$1,234.50");
  assert.strictEqual(Trading.pct(12.345, 1), "12.3%");
  assert.strictEqual(Trading.num(Infinity), "∞");
  const f = Trading.formatter(win);
  assert.strictEqual(f.size(1), "1 contract");
  assert.strictEqual(f.size(2), "2 contracts");
  assert.strictEqual(f.price(130000), "130,000");
  const btc = Trading.formatter(Instruments.resolve("BTC"));
  assert.strictEqual(btc.size(0.0666), "0.0666 BTC");
});
