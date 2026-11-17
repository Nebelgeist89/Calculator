/*
 * Interface check in a simulated browser.
 * Setup once:  npm install
 * Run:         npm run test:ui
 */
const { JSDOM } = require("jsdom");
const path = require("path");
const assert = require("assert");

(async () => {
  const dom = await JSDOM.fromFile(path.join(__dirname, "..", "index.html"), {
    runScripts: "dangerously",
    resources: "usable",
  });
  await new Promise((resolve) => dom.window.addEventListener("load", resolve));

  const { document, Event, KeyboardEvent } = dom.window;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const headline = () => $(".headline-value").textContent;
  const rows = () => Object.fromEntries($$(".rows .row").map((r) => [r.querySelector("dt").textContent, r.querySelector("dd").textContent]));

  function type(selector, value) {
    const el = $(selector);
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function choose(selector, value) {
    const el = $(selector);
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function openTool(title) {
    const button = $$(".tool-btn").find((b) => b.querySelector(".tool-title").textContent === title);
    assert.ok(button, "no tool called " + title);
    button.click();
  }
  const step = (name, fn) => {
    fn();
    console.log("ok -", name);
  };

  step("desk shows the WIN tick value", () => {
    assert.strictEqual($("#instrument").value, "WIN");
    assert.match($("#tick-readout").textContent, /One tick of 5 is worth .*1\.00 per contract/);
  });

  step("position size opens first with a ruler", () => {
    assert.strictEqual($(".inputs h2").textContent, "Position size");
    assert.strictEqual(headline(), "1 contract");
    assert.strictEqual($$(".ruler .mark").length, 2);
    assert.ok($(".ruler.intro"), "first ruler plays the intro");
  });

  step("editing the stop updates the result", () => {
    type("#f-position-size-stop", "129900");
    assert.strictEqual(headline(), "5 contracts");
    assert.strictEqual(rows()["Direction"], "Long");
    type("#f-position-size-stop", "130100");
    assert.strictEqual(rows()["Direction"], "Short");
  });

  step("an impossible input explains itself", () => {
    type("#f-position-size-stop", "130000");
    assert.match($(".message.error").textContent, /Stop must differ from entry/);
    type("#f-position-size-stop", "");
    assert.match($(".message").textContent, /Enter stop price/);
    type("#f-position-size-stop", "129700");
  });

  step("desk risk and account feed the result", () => {
    type("#account", "50000");
    assert.strictEqual(headline(), "8 contracts");
    type("#risk", "0.5");
    assert.strictEqual(headline(), "4 contracts");
    type("#account", "10000");
    type("#risk", "1");
  });

  step("editing contract specs changes the math", () => {
    $("details.specs").open = true;
    type("#spec-pointValue", "0.1");
    assert.strictEqual(headline(), "3 contracts");
    assert.ok(!$("#reset-specs").hidden);
    $("#reset-specs").click();
    assert.strictEqual($("#spec-pointValue").value, "0.2");
    assert.strictEqual(headline(), "1 contract");
    assert.ok($("#reset-specs").hidden);
  });

  step("switching instrument resets the inputs to that instrument", () => {
    choose("#instrument", "ES");
    assert.strictEqual($("#account-unit").textContent, "USD");
    assert.strictEqual(headline(), "0 contracts");
    assert.match($(".note").textContent, /smaller than the cost of one contract/);
    assert.strictEqual($("#f-position-size-entry").value, "6000");
    choose("#instrument", "WIN");
    assert.strictEqual($("#f-position-size-entry").value, "130000");
  });

  step("custom instrument shows a currency picker", () => {
    assert.ok($("#currency-field").hidden);
    choose("#instrument", "CUSTOM");
    assert.ok(!$("#currency-field").hidden);
    choose("#currency", "EUR");
    assert.strictEqual($("#account-unit").textContent, "EUR");
    choose("#instrument", "WIN");
    assert.ok($("#currency-field").hidden);
  });

  step("risk to reward", () => {
    openTool("Risk to reward");
    assert.strictEqual(headline(), "1 : 2");
    assert.strictEqual($$(".ruler .mark").length, 3);
    assert.ok(!$(".ruler.intro"), "intro plays only once");
    assert.strictEqual(rows()["Break-even win rate, before fees"], "33.3%");
  });

  step("net result with the long/short control", () => {
    openTool("Net result");
    assert.strictEqual(headline(), "R$60.00");
    $$("input[type=radio][value=short]")[0].click();
    assert.strictEqual(headline(), "-R$60.00");
    assert.ok($(".headline").classList.contains("tone-loss"));
    type("#f-net-pnl-fee", "2.5");
    assert.strictEqual(rows()["Fees"], "R$2.50");
  });

  step("expectancy and drawdown", () => {
    openTool("Expectancy and Kelly");
    assert.strictEqual(headline(), "0.35R per trade");
    openTool("Drawdown and growth");
    assert.strictEqual(headline(), "+25%");
    assert.strictEqual($$("table tbody tr").length, 5);
  });

  step("pivots and Fibonacci", () => {
    openTool("Pivots and Fibonacci");
    assert.strictEqual($$(".section").length, 3);
    assert.ok($(".rows").textContent.includes("R3"));
  });

  step("the open tool shows the spec instead of a form", () => {
    openTool("Scale in and out");
    assert.ok($(".open-tool"));
    assert.strictEqual($$(".form").length, 0);
    assert.match($(".open-tool a").getAttribute("href"), /CONTRIBUTING\.md$/);
  });

  step("scientific: live result, Enter saves, chips insert", () => {
    openTool("Scientific");
    type("#expr", "2+3*4");
    assert.strictEqual(headline(), "14");
    $("#expr").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    assert.strictEqual($("#expr").value, "14");
    assert.strictEqual($$(".history-item").length, 1);
    $$(".chip").find((b) => b.textContent === "ans").click();
    assert.strictEqual($("#expr").value, "ans");
    assert.strictEqual(headline(), "14");
    type("#expr", "sin(30)");
    assert.strictEqual(headline(), "0.5");
    $$("input[name=angle][value=rad]")[0].click();
    assert.notStrictEqual(headline(), "0.5");
    $$("input[name=angle][value=deg]")[0].click();
    type("#expr", "1/0");
    $("#expr").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    assert.match($(".message.error").textContent, /Division by zero/);
    $(".history-item").click();
    assert.strictEqual($("#expr").value, "2+3*4");
    $$(".btn").find((b) => b.textContent === "Clear history").click();
    assert.strictEqual($$(".history-item").length, 0);
  });

  step("tab list marks the current tool", () => {
    assert.strictEqual($$(".tool-btn[aria-current=page]").length, 1);
    assert.strictEqual($(".tool-btn[aria-current=page] .tool-title").textContent, "Scientific");
  });

  console.log("all UI checks passed");
  dom.window.close();
})().catch((err) => {
  console.error("UI check failed:", err.message);
  process.exit(1);
});
