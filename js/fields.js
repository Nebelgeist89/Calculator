/*
 * Form logic shared by every tool, kept apart from the DOM so it can be tested.
 *
 * A field is { id, label, kind, default, optional?, hint?, options? }.
 * kind is one of: price, money, percent, size, ticks, number, select.
 * label and default may be functions of the instrument.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Fields = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const resolve = (value, instrument) => (typeof value === "function" ? value(instrument) : value);
  const clean = (value) => Number(value.toPrecision(12));

  function defaultValue(field, instrument) {
    const value = resolve(field.default, instrument);
    return typeof value === "number" ? clean(value) : value;
  }

  function label(field, instrument) {
    return resolve(field.label, instrument);
  }

  /** Small unit shown after the input. */
  function suffix(field, instrument) {
    switch (field.kind) {
      case "money":
        return instrument.currency;
      case "percent":
        return "%";
      case "size":
        return instrument.unitPlural;
      case "ticks":
        return "ticks";
      default:
        return field.suffix || "";
    }
  }

  function parse(field, raw) {
    if (field.kind === "select") return raw;
    if (raw === undefined || raw === null || String(raw).trim() === "") return NaN;
    return Number(raw);
  }

  /**
   * Turns what the person typed (stored: field id -> raw text) into numbers,
   * falling back to each field's default. `missing` lists required fields left empty.
   */
  function collect(tool, instrument, stored) {
    const values = {};
    const missing = [];

    tool.fields.forEach((field) => {
      const raw = stored && stored[field.id] !== undefined ? stored[field.id] : defaultValue(field, instrument);
      const value = parse(field, raw);
      values[field.id] = value;
      if (!field.optional && field.kind !== "select" && !Number.isFinite(value)) {
        missing.push(label(field, instrument));
      }
    });

    return { values, missing };
  }

  return { defaultValue, label, suffix, parse, collect };
});
