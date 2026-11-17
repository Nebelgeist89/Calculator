/*
 * The Scientific tool has its own screen (an expression box and a history), so app.js
 * draws it directly when it sees `custom: "scientific"`. The math lives in expression.js.
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
    id: "scientific",
    title: "Scientific",
    summary: "Type an expression and press Enter. For the arithmetic the other tools don't cover.",
    custom: "scientific",
    fields: [],
  };
});
