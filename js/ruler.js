/*
 * Trade ruler: a vertical price ladder that shows where stop, entry and target sit.
 *
 * layout() turns prices into pixel positions and keeps labels from overlapping.
 * It has no DOM, so it runs in Node tests. render() draws the result as SVG.
 *
 * spec = {
 *   marks: [{ id, label, price, text }],         one line each, label shown at the left, text at the right
 *   zones: [{ from, to, tone: "gain" | "loss" }], shaded bands between two prices
 *   ticks: { origin, unit, direction, max } | null,  1R, 2R ... counted from origin
 *   caption: "text read by screen readers and shown below"
 * }
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Ruler = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MAX_TICKS = 6;
  const clean = (value) => Number(value.toPrecision(12));

  /** Push labels apart so each is at least `gap` below the one above, staying inside [min, max]. */
  function spread(ys, gap, min, max) {
    const order = ys.map((_, index) => index).sort((a, b) => ys[a] - ys[b]);
    const out = ys.slice();

    for (let n = 0; n < order.length; n += 1) {
      const i = order[n];
      if (out[i] < min) out[i] = min;
      if (n > 0 && out[i] < out[order[n - 1]] + gap) out[i] = out[order[n - 1]] + gap;
    }

    const last = order[order.length - 1];
    if (order.length > 0 && out[last] > max) {
      out[last] = max;
      for (let n = order.length - 2; n >= 0; n -= 1) {
        const i = order[n];
        if (out[i] > out[order[n + 1]] - gap) out[i] = out[order[n + 1]] - gap;
      }
    }
    return out;
  }

  function layout(spec, options) {
    const o = Object.assign({ height: 380, top: 28, bottom: 28, gap: 20 }, options);

    const ticks = [];
    const t = spec.ticks;
    if (t && t.unit > 0 && t.max > 0) {
      const count = Math.min(Math.floor(t.max), MAX_TICKS);
      for (let k = 1; k <= count; k += 1) {
        ticks.push({ label: k + "R", price: clean(t.origin + t.direction * t.unit * k) });
      }
    }

    const prices = spec.marks.map((mark) => mark.price).concat(ticks.map((tick) => tick.price));
    let low = Math.min.apply(null, prices);
    let high = Math.max.apply(null, prices);
    if (high === low) {
      const pad = Math.abs(high) * 0.001 || 1;
      low -= pad;
      high += pad;
    }
    const margin = (high - low) * 0.06;
    low -= margin;
    high += margin;

    const drawable = o.height - o.top - o.bottom;
    const y = (price) => o.top + ((high - price) / (high - low)) * drawable;

    const labelYs = spread(spec.marks.map((mark) => y(mark.price)), o.gap, o.top, o.height - o.bottom);

    return {
      height: o.height,
      min: low,
      max: high,
      marks: spec.marks.map((mark, i) => Object.assign({}, mark, { y: y(mark.price), labelY: labelYs[i] })),
      zones: (spec.zones || []).map((zone) => ({
        tone: zone.tone,
        y1: Math.min(y(zone.from), y(zone.to)),
        y2: Math.max(y(zone.from), y(zone.to)),
      })),
      // a tick that lands on a mark (the target sitting exactly at 2R) would be drawn under its line
      ticks: ticks
        .map((tick) => Object.assign({}, tick, { y: y(tick.price) }))
        .filter((tick) => !spec.marks.some((mark) => Math.abs(y(mark.price) - tick.y) < 4)),
    };
  }

  function render(spec, options) {
    const o = options || {};
    const doc = o.document || document;
    const W = 290;
    const H = 380;
    const AXIS = 150;
    const L = layout(spec, { height: H });
    const NS = "http://www.w3.org/2000/svg";

    function make(name, attrs, text) {
      const node = doc.createElementNS(NS, name);
      Object.keys(attrs || {}).forEach((key) => node.setAttribute(key, attrs[key]));
      if (text !== undefined) node.textContent = text;
      return node;
    }

    const svg = make("svg", {
      viewBox: "0 0 " + W + " " + H,
      class: "ruler" + (o.intro ? " intro" : ""),
      role: "img",
      "aria-label": spec.caption || "Price ruler",
    });

    L.zones.forEach((zone) => {
      svg.appendChild(
        make("rect", {
          class: "zone zone-" + zone.tone,
          x: AXIS - 10,
          y: zone.y1,
          width: 20,
          height: Math.max(zone.y2 - zone.y1, 1),
        })
      );
    });

    svg.appendChild(make("line", { class: "axis", x1: AXIS, x2: AXIS, y1: 14, y2: H - 14 }));

    L.ticks.forEach((tick) => {
      svg.appendChild(make("line", { class: "tick-line", x1: AXIS - 7, x2: AXIS + 7, y1: tick.y, y2: tick.y }));
      svg.appendChild(make("text", { class: "tick-label", x: AXIS + 12, y: tick.y, dy: "0.35em" }, tick.label));
    });

    L.marks.forEach((mark, i) => {
      const group = make("g", { class: "mark mark-" + mark.id, style: "--i:" + i });
      group.appendChild(make("line", { class: "mark-line", x1: 104, x2: 196, y1: mark.y, y2: mark.y }));
      if (Math.abs(mark.labelY - mark.y) > 0.5) {
        group.appendChild(make("line", { class: "leader", x1: 196, y1: mark.y, x2: 202, y2: mark.labelY }));
      }
      group.appendChild(
        make("text", { class: "mark-name", x: 98, y: mark.labelY, dy: "0.35em", "text-anchor": "end" }, mark.label)
      );
      group.appendChild(make("text", { class: "mark-price", x: 206, y: mark.labelY, dy: "0.35em" }, mark.text));
      svg.appendChild(group);
    });

    return svg;
  }

  return { layout, render, spread };
});
