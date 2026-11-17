(function () {
  "use strict";

  const Trading = window.Trading;
  const Instruments = window.Instruments;
  const Fields = window.Fields;
  const Ruler = window.Ruler;
  const Expr = window.CalcExpression;
  const tools = window.CalculatorTools || [];

  const STORAGE_KEY = "trading-desk-v1";
  const MAX_HISTORY = 30;
  const SPEC_FIELDS = [
    { key: "pointValue", label: "Point value", hint: "Money per 1.0 of price move, for one unit." },
    { key: "tickSize", label: "Tick size", hint: "Smallest price step." },
    { key: "lotStep", label: "Smallest size", hint: "Smallest size you can trade." },
  ];
  const SCI_CHIPS = ["sin(", "cos(", "tan(", "√(", "ln(", "log(", "π", "e", "^", "!", "%", "ans"];
  const SCI_OPERATOR = /^[+\-*/^!%×÷−]/;

  // ---------- small helpers ----------

  const byId = (id) => document.getElementById(id);
  const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    Object.keys(attrs || {}).forEach((key) => {
      const value = attrs[key];
      if (value === false || value === null || value === undefined) return;
      if (key === "class") el.className = value;
      else if (key === "text") el.textContent = value;
      else if (key.indexOf("on") === 0) el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value === true ? "" : value);
    });
    children.flat().forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      el.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return el;
  }

  function readNumber(text) {
    return String(text).trim() === "" ? NaN : Number(text);
  }

  function joinList(items) {
    if (items.length <= 1) return items.join("");
    return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  }

  const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);

  // ---------- state ----------

  function loadState() {
    const state = {
      instrumentId: "WIN",
      currency: "USD",
      account: 10000,
      riskPct: 1,
      toolId: tools[0].id,
      angle: "deg",
      overrides: {},
      inputs: {},
      history: [],
    };

    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (err) {
      saved = null;
    }
    if (!isObject(saved)) return state;

    if (Instruments.get(saved.instrumentId)) state.instrumentId = saved.instrumentId;
    if (Instruments.CURRENCIES.indexOf(saved.currency) !== -1) state.currency = saved.currency;
    if (isNumber(saved.account)) state.account = saved.account;
    if (isNumber(saved.riskPct)) state.riskPct = saved.riskPct;
    if (tools.some((tool) => tool.id === saved.toolId)) state.toolId = saved.toolId;
    if (saved.angle === "rad") state.angle = "rad";

    if (isObject(saved.overrides)) {
      Object.keys(saved.overrides).forEach((id) => {
        if (!Instruments.get(id) || !isObject(saved.overrides[id])) return;
        const kept = {};
        SPEC_FIELDS.forEach((field) => {
          if (isNumber(saved.overrides[id][field.key])) kept[field.key] = saved.overrides[id][field.key];
        });
        if (Object.keys(kept).length) state.overrides[id] = kept;
      });
    }

    if (isObject(saved.inputs)) {
      Object.keys(saved.inputs).forEach((toolId) => {
        if (!isObject(saved.inputs[toolId])) return;
        const kept = {};
        Object.keys(saved.inputs[toolId]).forEach((fieldId) => {
          if (typeof saved.inputs[toolId][fieldId] === "string") kept[fieldId] = saved.inputs[toolId][fieldId];
        });
        state.inputs[toolId] = kept;
      });
    }

    if (Array.isArray(saved.history)) {
      state.history = saved.history
        .filter((item) => isObject(item) && typeof item.expr === "string" && typeof item.result === "string")
        .slice(0, MAX_HISTORY);
    }
    return state;
  }

  const state = loadState();

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      /* storage can be blocked; the desk simply won't remember between visits */
    }
  }

  const hashTool = window.location.hash.slice(1);
  if (tools.some((tool) => tool.id === hashTool)) state.toolId = hashTool;

  const currentTool = () => tools.find((tool) => tool.id === state.toolId) || tools[0];
  const currentInstrument = () =>
    Instruments.resolve(state.instrumentId, state.overrides[state.instrumentId], state.currency);

  // ---------- elements ----------

  const instrumentEl = byId("instrument");
  const currencyField = byId("currency-field");
  const currencyEl = byId("currency");
  const accountEl = byId("account");
  const accountUnitEl = byId("account-unit");
  const riskEl = byId("risk");
  const readoutEl = byId("tick-readout");
  const specGridEl = byId("spec-grid");
  const resetSpecsEl = byId("reset-specs");
  const toolListEl = byId("tool-list");
  const inputsEl = byId("inputs");
  const resultEl = byId("result");

  const specInputs = {};
  let introPlayed = false;

  // ---------- desk ----------

  function buildDesk() {
    Instruments.groups().forEach((group) => {
      const optgroup = h("optgroup", { label: group.label });
      group.items.forEach((preset) => optgroup.append(h("option", { value: preset.id, text: preset.name })));
      instrumentEl.append(optgroup);
    });

    Instruments.CURRENCIES.forEach((code) => currencyEl.append(h("option", { value: code, text: code })));

    SPEC_FIELDS.forEach((field) => {
      const id = "spec-" + field.key;
      const input = h("input", { id, type: "number", step: "any", min: "0", inputmode: "decimal", autocomplete: "off" });
      specInputs[field.key] = input;
      input.addEventListener("input", () => onSpecInput(field.key, input.value));
      specGridEl.append(
        h("div", { class: "field" }, h("label", { for: id, text: field.label }), h("div", { class: "input-wrap" }, input), h("small", { class: "hint", text: field.hint }))
      );
    });

    instrumentEl.addEventListener("change", () => {
      state.instrumentId = instrumentEl.value;
      state.inputs = {};
      syncDesk();
      renderInputs();
      renderResult();
      save();
    });

    currencyEl.addEventListener("change", () => {
      state.currency = currencyEl.value;
      syncDesk();
      renderInputs();
      renderResult();
      save();
    });

    accountEl.addEventListener("input", () => {
      state.account = readNumber(accountEl.value);
      renderResult();
      save();
    });

    riskEl.addEventListener("input", () => {
      state.riskPct = readNumber(riskEl.value);
      renderResult();
      save();
    });

    resetSpecsEl.addEventListener("click", () => {
      delete state.overrides[state.instrumentId];
      syncDesk();
      renderResult();
      save();
    });
  }

  function onSpecInput(key, raw) {
    const id = state.instrumentId;
    const preset = Instruments.get(id);
    const value = readNumber(raw);
    const overrides = state.overrides[id] || (state.overrides[id] = {});

    if (value === preset[key]) delete overrides[key];
    else overrides[key] = value;
    if (Object.keys(overrides).length === 0) delete state.overrides[id];

    updateReadout();
    renderResult();
    save();
  }

  function syncDesk() {
    const inst = currentInstrument();
    instrumentEl.value = state.instrumentId;
    currencyField.hidden = state.instrumentId !== "CUSTOM";
    currencyEl.value = inst.currency;
    accountEl.value = Number.isFinite(state.account) ? String(state.account) : "";
    riskEl.value = Number.isFinite(state.riskPct) ? String(state.riskPct) : "";
    accountUnitEl.textContent = inst.currency;
    SPEC_FIELDS.forEach((field) => {
      specInputs[field.key].value = Number.isFinite(inst[field.key]) ? String(inst[field.key]) : "";
    });
    resetSpecsEl.hidden = !inst.edited;
    updateReadout();
  }

  function updateReadout() {
    const inst = currentInstrument();
    resetSpecsEl.hidden = !inst.edited;
    if (!(inst.tickSize > 0) || !(inst.pointValue > 0)) {
      readoutEl.textContent = "";
      return;
    }
    const tickValue = Number((inst.tickSize * inst.pointValue).toPrecision(12));
    readoutEl.textContent =
      "One tick of " + Trading.num(inst.tickSize, 8) + " is worth " + Trading.money(tickValue, inst.currency) + " per " + inst.unit + ".";
  }

  // ---------- tool list ----------

  function renderNav() {
    toolListEl.textContent = "";
    tools.forEach((tool) => {
      toolListEl.append(
        h(
          "li",
          {},
          h(
            "button",
            {
              type: "button",
              class: "tool-btn",
              "aria-current": tool.id === state.toolId ? "page" : false,
              onclick: () => selectTool(tool.id),
            },
            h("span", { class: "tool-title", text: tool.title }),
            tool.status === "open" ? h("span", { class: "tool-flag", text: "Open for contribution" }) : null
          )
        )
      );
    });
  }

  function selectTool(id) {
    state.toolId = id;
    try {
      window.history.replaceState(null, "", "#" + id);
    } catch (err) {
      /* some browsers refuse this on local files; the tool still switches */
    }
    renderNav();
    renderInputs();
    renderResult();
    save();
  }

  // ---------- inputs ----------

  function setInput(tool, fieldId, raw) {
    const stored = state.inputs[tool.id] || (state.inputs[tool.id] = {});
    stored[fieldId] = raw;
    renderResult();
    save();
  }

  function fieldControl(tool, field, inst) {
    const id = "f-" + tool.id + "-" + field.id;
    const stored = state.inputs[tool.id] && state.inputs[tool.id][field.id];
    const value = stored !== undefined ? stored : Fields.defaultValue(field, inst);
    const labelText = Fields.label(field, inst);

    if (field.kind === "select") {
      return h(
        "fieldset",
        { class: "field segmented" },
        h("legend", { text: labelText }),
        h(
          "div",
          { class: "seg-options" },
          field.options.map((option) =>
            h(
              "label",
              {},
              h("input", {
                type: "radio",
                name: id,
                value: option.value,
                checked: String(value) === option.value,
                onchange: () => setInput(tool, field.id, option.value),
              }),
              h("span", { text: option.label })
            )
          )
        )
      );
    }

    const input = h("input", {
      id,
      type: "number",
      step: "any",
      inputmode: "decimal",
      autocomplete: "off",
      value: String(value),
      oninput: (event) => setInput(tool, field.id, event.target.value),
    });
    const unit = Fields.suffix(field, inst);

    return h(
      "div",
      { class: "field" },
      h("label", { for: id, text: labelText }),
      h("div", { class: "input-wrap" }, input, unit ? h("em", { text: unit }) : null),
      field.hint ? h("small", { class: "hint", text: field.hint }) : null
    );
  }

  function renderInputs() {
    const tool = currentTool();
    inputsEl.textContent = "";
    inputsEl.append(h("h2", { text: tool.title }), h("p", { class: "summary", text: tool.summary }));

    if (tool.custom === "scientific") {
      renderScientificInputs();
      return;
    }
    if (tool.status === "open") return;

    const inst = currentInstrument();
    inputsEl.append(h("div", { class: "form" }, tool.fields.map((field) => fieldControl(tool, field, inst))));
  }

  // ---------- results ----------

  function message(kind, text) {
    return h("p", { class: "message " + kind, text });
  }

  function headlineEl(label, value, tone) {
    return h(
      "p",
      { class: "headline" + (tone ? " tone-" + tone : "") },
      h("span", { class: "headline-label", text: label }),
      h("span", { class: "headline-value", text: value })
    );
  }

  function rowsEl(rows) {
    return h(
      "dl",
      { class: "rows" },
      rows.map((row) =>
        h(
          "div",
          { class: "row" },
          h("dt", { text: row.label }),
          h("dd", { class: row.tone ? "tone-" + row.tone : "", text: row.value })
        )
      )
    );
  }

  function tableEl(table) {
    return h(
      "div",
      { class: "table-block" },
      h("h3", { text: table.title }),
      h(
        "div",
        { class: "table-wrap" },
        h(
          "table",
          {},
          h("thead", {}, h("tr", {}, table.columns.map((column) => h("th", { scope: "col", text: column })))),
          h("tbody", {}, table.rows.map((row) => h("tr", {}, row.map((cell) => h("td", { text: cell })))))
        )
      )
    );
  }

  function buildResult(out) {
    const main = h("div", { class: "result-main" }, headlineEl(out.headline.label, out.headline.value, out.headline.tone));

    (out.sections || []).forEach((section) => {
      main.append(h("div", { class: "section" }, section.title ? h("h3", { text: section.title }) : null, rowsEl(section.rows)));
    });
    if (out.table) main.append(tableEl(out.table));
    (out.notes || []).forEach((note) => main.append(h("p", { class: "note", text: note })));

    const grid = h("div", { class: "result-grid" + (out.ruler ? " has-ruler" : "") }, main);
    if (out.ruler) {
      const svg = Ruler.render(out.ruler, { document, intro: !introPlayed });
      introPlayed = true;
      grid.append(h("figure", { class: "ruler-panel" }, svg, h("figcaption", { text: out.ruler.caption })));
    }
    return grid;
  }

  function renderOpenTool(tool) {
    resultEl.append(
      h(
        "div",
        { class: "open-tool" },
        h("h3", { text: "Open for contribution" }),
        h("p", { text: "This tool is not built yet. It should do the following:" }),
        h("ul", {}, tool.spec.map((line) => h("li", { text: line }))),
        h(
          "p",
          {},
          "The full spec, with the function signature and examples, is in ",
          h("a", { href: tool.specUrl, target: "_blank", rel: "noopener" }, "CONTRIBUTING.md"),
          "."
        )
      )
    );
  }

  function renderResult() {
    const tool = currentTool();
    resultEl.textContent = "";

    if (tool.custom === "scientific") {
      renderScientificResult();
      return;
    }
    if (tool.status === "open") {
      renderOpenTool(tool);
      return;
    }

    const inst = currentInstrument();
    const { values, missing } = Fields.collect(tool, inst, state.inputs[tool.id]);
    if (missing.length) {
      resultEl.append(message("info", "Enter " + joinList(missing.map(lowerFirst)) + " to see the result."));
      return;
    }

    const desk = { instrument: inst, account: state.account, riskPct: state.riskPct };
    let out;
    try {
      out = tool.compute(values, desk);
    } catch (err) {
      resultEl.append(message("error", err.message));
      return;
    }
    resultEl.append(buildResult(out));
  }

  // ---------- scientific tool ----------

  const sci = { expr: "", error: "", fresh: false };

  function sciAns() {
    const last = state.history.length ? Number(state.history[0].result) : 0;
    return Number.isFinite(last) ? last : 0;
  }

  function sciInsert(text) {
    const input = byId("expr");
    if (sci.fresh) {
      if (SCI_OPERATOR.test(text)) input.setSelectionRange(input.value.length, input.value.length);
      else input.value = "";
      sci.fresh = false;
    }
    input.setRangeText(text, input.selectionStart, input.selectionEnd, "end");
    input.focus();
    sci.expr = input.value;
    sci.error = "";
    renderScientificResult();
  }

  function sciCommit() {
    const text = sci.expr.trim();
    if (!text) return;
    try {
      const value = Expr.evaluate(text, { angle: state.angle, ans: sciAns() });
      const result = Expr.format(value);
      state.history.unshift({ expr: text, result });
      state.history = state.history.slice(0, MAX_HISTORY);
      sci.expr = result;
      sci.error = "";
      sci.fresh = true;
      byId("expr").value = result;
      save();
    } catch (err) {
      sci.error = err.message;
    }
    renderScientificResult();
  }

  function renderScientificInputs() {
    const input = h("input", {
      id: "expr",
      type: "text",
      class: "expr",
      autocomplete: "off",
      spellcheck: "false",
      autocapitalize: "off",
      "aria-label": "Expression",
      placeholder: "2*(3+4)^2",
      value: sci.expr,
    });

    input.addEventListener("input", () => {
      sci.expr = input.value;
      sci.error = "";
      renderScientificResult();
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        sciCommit();
        return;
      }
      if (event.key === "Escape") {
        input.value = "";
        sci.expr = "";
        sci.error = "";
        sci.fresh = false;
        renderScientificResult();
        return;
      }
      if (!sci.fresh) return;
      if (event.key === "Backspace" || event.key === "Delete") {
        sci.fresh = false;
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (SCI_OPERATOR.test(event.key)) input.setSelectionRange(input.value.length, input.value.length);
        else input.value = "";
        sci.fresh = false;
      }
    });

    const angle = h(
      "fieldset",
      { class: "field segmented" },
      h("legend", { text: "Angles" }),
      h(
        "div",
        { class: "seg-options" },
        [
          { value: "deg", label: "Degrees" },
          { value: "rad", label: "Radians" },
        ].map((option) =>
          h(
            "label",
            {},
            h("input", {
              type: "radio",
              name: "angle",
              value: option.value,
              checked: state.angle === option.value,
              onchange: () => {
                state.angle = option.value;
                renderScientificResult();
                save();
              },
            }),
            h("span", { text: option.label })
          )
        )
      )
    );

    const chips = h(
      "div",
      { class: "chips", role: "group", "aria-label": "Insert" },
      SCI_CHIPS.map((text) =>
        h("button", { type: "button", class: "btn chip", onclick: () => sciInsert(text), text: text.replace("(", "") })
      )
    );

    inputsEl.append(
      h(
        "div",
        { class: "form" },
        h("div", { class: "field" }, h("label", { for: "expr", text: "Expression" }), input, h("small", { class: "hint", text: "Press Enter to save the result to history. Esc clears." })),
        angle,
        chips
      )
    );
  }

  function renderScientificResult() {
    resultEl.textContent = "";
    const text = sci.expr.trim();
    let valueText = "—";
    if (text) {
      try {
        valueText = Expr.format(Expr.evaluate(text, { angle: state.angle, ans: sciAns() }));
      } catch (err) {
        valueText = "—";
      }
    }

    const main = h("div", { class: "result-main" }, headlineEl("Result", valueText));
    if (sci.error) main.append(message("error", sci.error));

    if (state.history.length === 0) {
      main.append(h("p", { class: "note", text: "Press Enter to keep a calculation here." }));
    } else {
      main.append(
        h(
          "div",
          { class: "section" },
          h(
            "div",
            { class: "history-head" },
            h("h3", { text: "History" }),
            h("button", {
              type: "button",
              class: "btn",
              text: "Clear history",
              onclick: () => {
                state.history = [];
                save();
                renderScientificResult();
              },
            })
          ),
          h(
            "ul",
            { class: "history" },
            state.history.map((item) =>
              h(
                "li",
                {},
                h(
                  "button",
                  {
                    type: "button",
                    class: "history-item",
                    onclick: () => {
                      const input = byId("expr");
                      input.value = item.expr;
                      sci.expr = item.expr;
                      sci.error = "";
                      sci.fresh = false;
                      renderScientificResult();
                      input.focus();
                    },
                  },
                  h("span", { class: "h-expr", text: item.expr }),
                  h("span", { class: "h-result", text: "= " + item.result })
                )
              )
            )
          )
        )
      );
    }
    resultEl.append(main);
  }

  // ---------- start ----------

  buildDesk();
  syncDesk();
  renderNav();
  renderInputs();
  renderResult();
})();
