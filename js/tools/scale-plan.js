/*
 * OPEN FOR CONTRIBUTION.
 *
 * This tool is a placeholder on purpose. The full spec is in CONTRIBUTING.md.
 * To build it: add the math to Trading.averageEntry() in js/trading.js, replace this
 * object with a normal tool (see position-size.js for the shape), and remove `status`.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    (root.CalculatorTools = root.CalculatorTools || []).push(factory());
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  return {
    id: "scale-plan",
    title: "Scale in and out",
    status: "open",
    summary: "Average entry, break-even and risk across several fills.",
    specUrl: "https://github.com/Nebelgeist89/Calculator/blob/main/CONTRIBUTING.md",
    spec: [
      "Take a list of fills, each with a price and a size.",
      "Return the average entry price and the total size.",
      "Return the break-even price after fees.",
      "Return the stop that keeps the whole position inside the risk per trade set on the desk.",
    ],
    fields: [],
    compute() {
      throw new Error("Not implemented yet. See CONTRIBUTING.md.");
    },
  };
});
