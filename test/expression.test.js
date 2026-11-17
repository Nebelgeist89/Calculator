const test = require("node:test");
const assert = require("node:assert");
const { evaluate, format } = require("../js/expression.js");

const near = (actual, expected, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} is not close to ${expected}`);

test("basic arithmetic and precedence", () => {
  assert.strictEqual(evaluate("2+3*4"), 14);
  assert.strictEqual(evaluate("(2+3)*4"), 20);
  assert.strictEqual(evaluate("10/4"), 2.5);
  assert.strictEqual(evaluate("10-4-3"), 3);
  assert.strictEqual(evaluate("0.1+0.2"), 0.3);
});

test("powers are right-associative and bind tighter than unary minus", () => {
  assert.strictEqual(evaluate("2^3^2"), 512);
  assert.strictEqual(evaluate("-2^2"), -4);
  assert.strictEqual(evaluate("2^-1"), 0.5);
});

test("unicode operators from the keypad", () => {
  assert.strictEqual(evaluate("6×7"), 42);
  assert.strictEqual(evaluate("8÷2"), 4);
  assert.strictEqual(evaluate("5−3"), 2);
});

test("implicit multiplication", () => {
  assert.strictEqual(evaluate("2(3+4)"), 14);
  assert.strictEqual(evaluate("(1+2)(3+4)"), 21);
  assert.strictEqual(evaluate("3sin(90)"), 3);
  near(evaluate("2π"), 2 * Math.PI);
});

test("percent and factorial", () => {
  assert.strictEqual(evaluate("50%"), 0.5);
  assert.strictEqual(evaluate("200*10%"), 20);
  assert.strictEqual(evaluate("5!"), 120);
  assert.strictEqual(evaluate("0!"), 1);
  assert.strictEqual(evaluate("3!^2"), 36);
  assert.strictEqual(evaluate("2^3!"), 64);
});

test("trig honours the angle mode", () => {
  assert.strictEqual(evaluate("sin(30)"), 0.5);
  assert.strictEqual(evaluate("cos(60)"), 0.5);
  assert.strictEqual(evaluate("cos(90)"), 0);
  assert.strictEqual(evaluate("sin(180)"), 0);
  assert.strictEqual(evaluate("tan(45)"), 1);
  assert.strictEqual(evaluate("asin(1)"), 90);
  assert.strictEqual(evaluate("atan(1)"), 45);
  assert.strictEqual(evaluate("sin(pi/2)", { angle: "rad" }), 1);
});

test("functions", () => {
  assert.strictEqual(evaluate("sqrt(16)"), 4);
  assert.strictEqual(evaluate("√(16)"), 4);
  assert.strictEqual(evaluate("cbrt(27)"), 3);
  assert.strictEqual(evaluate("ln(e)"), 1);
  assert.strictEqual(evaluate("log(1000)"), 3);
  assert.strictEqual(evaluate("log2(8)"), 3);
  assert.strictEqual(evaluate("abs(-5)"), 5);
  assert.strictEqual(evaluate("floor(2.7)"), 2);
  assert.strictEqual(evaluate("ceil(2.1)"), 3);
  assert.strictEqual(evaluate("round(2.5)"), 3);
  assert.strictEqual(evaluate("pow(2,10)"), 1024);
  assert.strictEqual(evaluate("mod(-1,3)"), 2);
  assert.strictEqual(evaluate("min(4,2,8)"), 2);
  assert.strictEqual(evaluate("max(1,5,3)"), 5);
});

test("constants, ans and exponent notation", () => {
  near(evaluate("e"), Math.E);
  assert.strictEqual(evaluate("ans*2", { ans: 21 }), 42);
  assert.strictEqual(evaluate("1e3+1"), 1001);
  near(evaluate("2e"), 2 * Math.E);
});

test("errors are reported clearly", () => {
  const fails = (expr, pattern) => assert.throws(() => evaluate(expr), pattern);
  fails("", /empty/i);
  fails("1/0", /division by zero/i);
  fails("2+", /unexpected end/i);
  fails("(1+2", /parenthes/i);
  fails(")", /unexpected/i);
  fails("foo(1)", /unknown/i);
  fails("sin 30", /parentheses/i);
  fails("pow(1)", /expects 2/i);
  fails("sqrt(-1)", /domain/i);
  fails("ln(0)", /domain/i);
  fails("(-1)!", /whole number/i);
  fails("171!", /too large/i);
  fails("2 3", /syntax/i);
  fails("2$3", /unexpected character/i);
  fails("0^-1", /math error/i);
  fails("tan(90)", /undefined/i);
});

test("format keeps normal numbers plain and shortens extremes", () => {
  assert.strictEqual(format(0.5), "0.5");
  assert.strictEqual(format(-2.5), "-2.5");
  assert.strictEqual(format(1234567), "1234567");
  assert.strictEqual(format(1e21), "1e+21");
  assert.strictEqual(format(1.5e21), "1.5e+21");
  assert.strictEqual(format(1e-12), "1e-12");
});
