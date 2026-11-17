/* Expression parser for the Scientific tool: small, safe, no eval. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CalcExpression = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const NUMBER_RE = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i;

  function tokenize(source) {
    const text = source
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/−/g, "-")
      .replace(/π/g, "pi")
      .replace(/√/g, "sqrt");
    const tokens = [];
    let i = 0;

    while (i < text.length) {
      const ch = text[i];

      if (/\s/.test(ch)) {
        i += 1;
        continue;
      }

      if (/[0-9.]/.test(ch)) {
        const match = NUMBER_RE.exec(text.slice(i));
        if (!match) throw new Error("Invalid number");
        tokens.push({ type: "num", value: parseFloat(match[0]) });
        i += match[0].length;
        continue;
      }

      if (/[a-z]/i.test(ch)) {
        const match = /^[a-z][a-z0-9]*/i.exec(text.slice(i));
        tokens.push({ type: "id", value: match[0].toLowerCase() });
        i += match[0].length;
        continue;
      }

      if ("+-*/^()!%,".includes(ch)) {
        tokens.push({ type: "op", value: ch });
        i += 1;
        continue;
      }

      throw new Error("Unexpected character '" + ch + "'");
    }

    return tokens;
  }

  function factorial(n) {
    if (!Number.isInteger(n) || n < 0) throw new Error("Factorial needs a whole number, 0 or more");
    if (n > 170) throw new Error("Result too large");
    let result = 1;
    for (let i = 2; i <= n; i += 1) result *= i;
    return result;
  }

  const domainError = () => new Error("Domain error");
  const snap = (x) => (Math.abs(x) < 1e-15 ? 0 : x);
  const clean = (x) => Number(x.toPrecision(12));

  /**
   * Evaluate an expression string.
   * options.angle: "deg" (default) or "rad"
   * options.ans:   value used for the `ans` constant
   */
  function evaluate(source, options) {
    const opts = options || {};
    const angle = opts.angle === "rad" ? "rad" : "deg";
    const ans = typeof opts.ans === "number" ? opts.ans : 0;

    const toRad = (x) => (angle === "deg" ? (x * Math.PI) / 180 : x);
    const fromRad = (x) => (angle === "deg" ? (x * 180) / Math.PI : x);

    const funcs = {
      sin: { n: 1, f: (x) => snap(Math.sin(toRad(x))) },
      cos: { n: 1, f: (x) => snap(Math.cos(toRad(x))) },
      tan: {
        n: 1,
        f: (x) => {
          const r = toRad(x);
          if (Math.abs(Math.cos(r)) < 1e-12) throw new Error("tan is undefined here");
          return snap(Math.tan(r));
        },
      },
      asin: {
        n: 1,
        f: (x) => {
          if (x < -1 || x > 1) throw domainError();
          return fromRad(Math.asin(x));
        },
      },
      acos: {
        n: 1,
        f: (x) => {
          if (x < -1 || x > 1) throw domainError();
          return fromRad(Math.acos(x));
        },
      },
      atan: { n: 1, f: (x) => fromRad(Math.atan(x)) },
      sqrt: {
        n: 1,
        f: (x) => {
          if (x < 0) throw domainError();
          return Math.sqrt(x);
        },
      },
      cbrt: { n: 1, f: Math.cbrt },
      ln: {
        n: 1,
        f: (x) => {
          if (x <= 0) throw domainError();
          return Math.log(x);
        },
      },
      log: {
        n: 1,
        f: (x) => {
          if (x <= 0) throw domainError();
          return Math.log10(x);
        },
      },
      log2: {
        n: 1,
        f: (x) => {
          if (x <= 0) throw domainError();
          return Math.log2(x);
        },
      },
      abs: { n: 1, f: Math.abs },
      exp: { n: 1, f: Math.exp },
      floor: { n: 1, f: Math.floor },
      ceil: { n: 1, f: Math.ceil },
      round: { n: 1, f: Math.round },
      pow: { n: 2, f: Math.pow },
      mod: {
        n: 2,
        f: (a, b) => {
          if (b === 0) throw new Error("Division by zero");
          return ((a % b) + b) % b;
        },
      },
      min: { n: "var", f: Math.min },
      max: { n: "var", f: Math.max },
    };

    const tokens = tokenize(source);
    if (tokens.length === 0) throw new Error("Empty expression");
    let pos = 0;

    const peek = () => tokens[pos];
    const isOp = (value) => {
      const t = peek();
      return Boolean(t) && t.type === "op" && t.value === value;
    };
    const startsOperand = () => {
      const t = peek();
      return Boolean(t) && (t.type === "id" || (t.type === "op" && t.value === "("));
    };
    const expectClose = () => {
      if (!isOp(")")) throw new Error("Missing closing parenthesis");
      pos += 1;
    };

    function parseExpr() {
      let value = parseTerm();
      while (isOp("+") || isOp("-")) {
        const op = tokens[pos++].value;
        const right = parseTerm();
        value = op === "+" ? value + right : value - right;
      }
      return value;
    }

    function parseTerm() {
      let value = parseUnary();
      for (;;) {
        if (isOp("*") || isOp("/")) {
          const op = tokens[pos++].value;
          const right = parseUnary();
          if (op === "/") {
            if (right === 0) throw new Error("Division by zero");
            value /= right;
          } else {
            value *= right;
          }
        } else if (startsOperand()) {
          value *= parseUnary(); // implicit multiplication: 2(3+4), 2pi, 3sin(30)
        } else {
          break;
        }
      }
      return value;
    }

    function parseUnary() {
      if (isOp("-")) {
        pos += 1;
        return -parseUnary();
      }
      if (isOp("+")) {
        pos += 1;
        return parseUnary();
      }
      return parsePower();
    }

    function parsePower() {
      const base = parsePostfix();
      if (isOp("^")) {
        pos += 1;
        const exponent = parseUnary(); // right-associative: 2^3^2 = 2^(3^2)
        const result = Math.pow(base, exponent);
        if (Number.isNaN(result)) throw domainError();
        return result;
      }
      return base;
    }

    function parsePostfix() {
      let value = parsePrimary();
      while (isOp("!") || isOp("%")) {
        const op = tokens[pos++].value;
        value = op === "!" ? factorial(value) : value / 100;
      }
      return value;
    }

    function parsePrimary() {
      const token = tokens[pos++];
      if (!token) throw new Error("Unexpected end of expression");

      if (token.type === "num") return token.value;

      if (token.type === "op" && token.value === "(") {
        const value = parseExpr();
        expectClose();
        return value;
      }

      if (token.type === "id") {
        if (token.value === "pi") return Math.PI;
        if (token.value === "e") return Math.E;
        if (token.value === "ans") return ans;

        const fn = funcs[token.value];
        if (!fn) throw new Error("Unknown name: " + token.value);
        if (!isOp("(")) throw new Error(token.value + " needs parentheses");
        pos += 1;

        const args = [];
        if (!isOp(")")) {
          args.push(parseExpr());
          while (isOp(",")) {
            pos += 1;
            args.push(parseExpr());
          }
        }
        expectClose();

        if (fn.n === "var") {
          if (args.length === 0) throw new Error(token.value + " needs at least one argument");
        } else if (args.length !== fn.n) {
          throw new Error(token.value + " expects " + fn.n + " argument(s)");
        }
        return fn.f(...args);
      }

      throw new Error("Unexpected '" + token.value + "'");
    }

    const result = parseExpr();
    if (pos < tokens.length) throw new Error("Syntax error near '" + tokens[pos].value + "'");
    if (!Number.isFinite(result)) throw new Error("Math error");
    return clean(result);
  }

  function format(n) {
    if (n !== 0 && (Math.abs(n) >= 1e15 || Math.abs(n) < 1e-9)) {
      return n.toExponential(6).replace(/\.?0+e/, "e");
    }
    return String(n);
  }

  return { evaluate, format, tokenize };
});
