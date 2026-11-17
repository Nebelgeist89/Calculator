# Contributing

One tool is deliberately left open: **Scale in and out**. It is a good first pull request. It needs one math function, one tool screen and the tests that go with them.

## What to build

Traders often enter a position in several fills. This tool answers: where am I really in, where do I break even, and where should the stop go?

### 1. The math: `Trading.averageEntry()` in `js/trading.js`

```js
Trading.averageEntry({
  side: "long",                                   // "long" or "short"
  fills: [{ price: 100, size: 1 }, { price: 98, size: 3 }],
  instrument,                                     // from Instruments.resolve(...)
  feePerUnit: 0.1,                                // optional, round trip, per unit
  riskBudget: 20,                                 // optional, money
});
```

It returns:

| Field | Meaning | Example above |
|---|---|---|
| `size` | Total size of all fills | `4` |
| `averagePrice` | Size-weighted average price | `98.5` |
| `breakEvenPrice` | Average price moved by `feePerUnit / pointValue` against you (up for a long, down for a short) | `98.6` |
| `stopPrice` | Stop that keeps the loss, fees included, equal to `riskBudget`. `null` when no budget is given | `93.6` |

The stop follows the same rule as `positionSize()`: fees count as part of the risk. For a long, `stopPrice = averagePrice - (riskBudget - size * feePerUnit) / (size * pointValue)`. A short mirrors it.

Errors are sentences a trader can act on, thrown with `new Error(...)`:

- `Add at least one fill.`
- `Each fill needs a price and a size above zero.`
- `Choose long or short.`
- `Risk budget must be larger than the fees.`

### 2. The tool: replace `js/tools/scale-plan.js`

Use `js/tools/position-size.js` as the model. A tool is an object with `fields` and a `compute(values, desk)` that returns a headline, rows and, optionally, a ruler. Delete `status`, `spec` and `specUrl` when it works.

Simplest start: four fixed fill rows (price and size each), where empty rows are ignored. The desk's **Risk per trade** and **Account** give the `riskBudget`: `account * riskPct / 100`.

For the ruler, mark the average price, break-even and stop, so the trader sees them against the individual fills.

### 3. The tests: `test/scale-plan.test.js`

1. Delete the test marked `stub`.
2. Remove `skip` from the four `spec` tests.
3. Make them pass.

Add a case to `test/tools.test.js` so the tool is checked on every instrument preset.

## Working on it

```bash
git checkout -b feature/scale-plan
npm test            # should be green before and after
# open index.html in a browser and try it
git add .
git commit -m "Add scale in and out tool"
git push -u origin feature/scale-plan
```

Then open a pull request on GitHub from `feature/scale-plan` into `main`.

## Checklist

- [ ] `npm test` passes, with no skipped tests left in `scale-plan.test.js`
- [ ] The tool works on WIN, WDO and a stock preset
- [ ] Errors read as plain sentences
- [ ] No new dependencies
- [ ] The README tool table mentions the tool
