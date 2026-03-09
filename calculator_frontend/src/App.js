import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

/**
 * Calculator supports the basic operations (+, −, ×, ÷), decimal entry,
 * clear, sign toggle, percent, and backspace.
 *
 * Implementation notes:
 * - We track display as a string to preserve user input intent (e.g. "0.", "1.00").
 * - We track an accumulator and a pending operator for chained operations.
 * - We compute on operator press using "immediate execution" model (like many simple calculators).
 */

/** Maximum number of characters allowed in the display (to keep layout stable). */
const MAX_DISPLAY_LEN = 18;

const OPERATORS = new Set(["+", "-", "*", "/"]);

/**
 * Format a numeric value for display (handles Infinity/NaN and trims noise).
 * @param {number} value
 * @returns {string}
 */
function formatNumberForDisplay(value) {
  if (Number.isNaN(value)) return "Error";
  if (!Number.isFinite(value)) return "Error";

  // Use a reasonable precision and strip trailing zeros.
  // This avoids huge floats from showing too many digits.
  const asStr = value.toPrecision(12);
  const normalized = String(Number(asStr)); // removes trailing zeros / scientific where possible
  return normalized;
}

/**
 * Clamp display length; if too large, attempt scientific notation, else show Error.
 * @param {string} display
 * @returns {string}
 */
function clampDisplay(display) {
  if (display.length <= MAX_DISPLAY_LEN) return display;

  // Try to convert to scientific with limited precision if it's a number.
  const n = Number(display);
  if (!Number.isFinite(n)) return "Error";

  const sci = n.toExponential(6);
  if (sci.length <= MAX_DISPLAY_LEN) return sci;

  return "Error";
}

/**
 * Apply an arithmetic operation.
 * @param {number} left
 * @param {number} right
 * @param {"+"|"-"|"*"|"/"} op
 * @returns {number}
 */
function applyOperation(left, right, op) {
  switch (op) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return right === 0 ? NaN : left / right;
    default:
      return right;
  }
}

/**
 * Whether a string represents a "user-editable number entry" (not Error).
 * @param {string} display
 * @returns {boolean}
 */
function isEditableNumberDisplay(display) {
  return display !== "Error";
}

// PUBLIC_INTERFACE
function App() {
  const [display, setDisplay] = useState("0");
  const [accumulator, setAccumulator] = useState(null); // number | null
  const [pendingOp, setPendingOp] = useState(null); // "+"|"-"|"*"|"/"|null
  const [overwrite, setOverwrite] = useState(true); // if next digit should overwrite display
  const [lastKey, setLastKey] = useState(null); // for subtle UX improvements

  const operatorLabel = useMemo(() => {
    if (!pendingOp) return "";
    if (pendingOp === "*") return "×";
    if (pendingOp === "/") return "÷";
    return pendingOp;
  }, [pendingOp]);

  const safeSetDisplay = useCallback((next) => {
    setDisplay(clampDisplay(next));
  }, []);

  const clearAll = useCallback(() => {
    setAccumulator(null);
    setPendingOp(null);
    setOverwrite(true);
    setLastKey("AC");
    safeSetDisplay("0");
  }, [safeSetDisplay]);

  const inputDigit = useCallback(
    (digit) => {
      setLastKey(digit);

      setDisplay((prev) => {
        if (!isEditableNumberDisplay(prev)) return digit;

        if (overwrite) {
          setOverwrite(false);
          return digit;
        }

        // prevent leading zeros like "0002"
        if (prev === "0") return digit;

        return prev + digit;
      });
    },
    [overwrite]
  );

  const inputDecimal = useCallback(() => {
    setLastKey(".");

    setDisplay((prev) => {
      if (!isEditableNumberDisplay(prev)) {
        setOverwrite(false);
        return "0.";
      }

      if (overwrite) {
        setOverwrite(false);
        return "0.";
      }

      if (prev.includes(".")) return prev;
      return prev + ".";
    });
  }, [overwrite]);

  const backspace = useCallback(() => {
    setLastKey("⌫");

    setDisplay((prev) => {
      if (!isEditableNumberDisplay(prev)) {
        setOverwrite(true);
        return "0";
      }

      if (overwrite) return "0";

      if (prev.length <= 1) {
        setOverwrite(true);
        return "0";
      }

      const next = prev.slice(0, -1);
      if (next === "-" || next === "") {
        setOverwrite(true);
        return "0";
      }
      return next;
    });
  }, [overwrite]);

  const toggleSign = useCallback(() => {
    setLastKey("±");

    setDisplay((prev) => {
      if (!isEditableNumberDisplay(prev)) return prev;
      if (prev === "0" || prev === "0.") return prev;

      if (prev.startsWith("-")) return prev.slice(1);
      return `-${prev}`;
    });
  }, []);

  const percent = useCallback(() => {
    setLastKey("%");

    setDisplay((prev) => {
      if (!isEditableNumberDisplay(prev)) return prev;
      const n = Number(prev);
      if (!Number.isFinite(n)) return "Error";
      setOverwrite(true);
      return formatNumberForDisplay(n / 100);
    });
  }, []);

  const computeIfPossible = useCallback(
    (rightValue) => {
      if (accumulator === null || !pendingOp) return rightValue;
      const result = applyOperation(accumulator, rightValue, pendingOp);
      return result;
    },
    [accumulator, pendingOp]
  );

  const commitOperator = useCallback(
    (op) => {
      setLastKey(op);

      // If currently showing error, ignore operator.
      if (!isEditableNumberDisplay(display)) return;

      const currentValue = Number(display);
      if (!Number.isFinite(currentValue)) {
        safeSetDisplay("Error");
        setOverwrite(true);
        return;
      }

      if (accumulator === null) {
        setAccumulator(currentValue);
      } else if (!overwrite) {
        // Only compute if user actually entered a new number since last operator.
        const result = computeIfPossible(currentValue);
        if (!Number.isFinite(result)) {
          safeSetDisplay("Error");
          setAccumulator(null);
          setPendingOp(null);
          setOverwrite(true);
          return;
        }
        setAccumulator(result);
        safeSetDisplay(formatNumberForDisplay(result));
      }

      setPendingOp(op);
      setOverwrite(true);
    },
    [accumulator, computeIfPossible, display, overwrite, safeSetDisplay]
  );

  const equals = useCallback(() => {
    setLastKey("=");

    if (!isEditableNumberDisplay(display)) return;

    if (pendingOp === null || accumulator === null) {
      // Nothing to compute.
      setOverwrite(true);
      return;
    }

    const rightValue = Number(display);
    if (!Number.isFinite(rightValue)) {
      safeSetDisplay("Error");
      setAccumulator(null);
      setPendingOp(null);
      setOverwrite(true);
      return;
    }

    const result = applyOperation(accumulator, rightValue, pendingOp);
    if (!Number.isFinite(result)) {
      safeSetDisplay("Error");
      setAccumulator(null);
      setPendingOp(null);
      setOverwrite(true);
      return;
    }

    const formatted = formatNumberForDisplay(result);
    safeSetDisplay(formatted);
    setAccumulator(null);
    setPendingOp(null);
    setOverwrite(true);
  }, [accumulator, display, pendingOp, safeSetDisplay]);

  const handleButton = useCallback(
    (action) => {
      if (action.type === "digit") return inputDigit(action.value);
      if (action.type === "decimal") return inputDecimal();
      if (action.type === "operator") return commitOperator(action.value);
      if (action.type === "equals") return equals();
      if (action.type === "clear") return clearAll();
      if (action.type === "backspace") return backspace();
      if (action.type === "toggleSign") return toggleSign();
      if (action.type === "percent") return percent();
    },
    [
      backspace,
      clearAll,
      commitOperator,
      equals,
      inputDecimal,
      inputDigit,
      percent,
      toggleSign,
    ]
  );

  // Keyboard support for convenience.
  useEffect(() => {
    const onKeyDown = (e) => {
      const { key } = e;

      if (key >= "0" && key <= "9") {
        e.preventDefault();
        handleButton({ type: "digit", value: key });
        return;
      }

      if (key === ".") {
        e.preventDefault();
        handleButton({ type: "decimal" });
        return;
      }

      if (OPERATORS.has(key)) {
        e.preventDefault();
        handleButton({ type: "operator", value: key });
        return;
      }

      if (key === "Enter" || key === "=") {
        e.preventDefault();
        handleButton({ type: "equals" });
        return;
      }

      if (key === "Backspace") {
        e.preventDefault();
        handleButton({ type: "backspace" });
        return;
      }

      if (key === "Escape") {
        e.preventDefault();
        handleButton({ type: "clear" });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleButton]);

  const secondaryLine = useMemo(() => {
    // Subtle “operation in progress” line like: "12 ×"
    if (accumulator === null || !pendingOp) return "";
    return `${formatNumberForDisplay(accumulator)} ${operatorLabel}`;
  }, [accumulator, operatorLabel, pendingOp]);

  return (
    <div className="App">
      <main className="calc-shell" aria-label="Calculator">
        <header className="calc-header">
          <div className="calc-brand">
            <div className="calc-title">Calculator</div>
            <div className="calc-subtitle">Simple arithmetic</div>
          </div>
          <div className="calc-hint" aria-hidden="true">
            Keyboard: 0-9, + − × ÷, Enter, Backspace, Esc
          </div>
        </header>

        <section className="calc" aria-label="Calculator panel">
          <div className="display" role="region" aria-label="Display">
            <div className="display-secondary" aria-label="Pending operation">
              {secondaryLine}
            </div>
            <output
              className="display-main"
              aria-label="Current value"
              aria-live="polite"
            >
              {display}
            </output>
          </div>

          <div className="keypad" role="group" aria-label="Keypad">
            <button
              type="button"
              className="btn btn-fn"
              onClick={() => handleButton({ type: "clear" })}
              aria-label="All clear"
              data-testid="btn-ac"
            >
              AC
            </button>
            <button
              type="button"
              className="btn btn-fn"
              onClick={() => handleButton({ type: "toggleSign" })}
              aria-label="Toggle sign"
            >
              ±
            </button>
            <button
              type="button"
              className="btn btn-fn"
              onClick={() => handleButton({ type: "percent" })}
              aria-label="Percent"
            >
              %
            </button>
            <button
              type="button"
              className="btn btn-op"
              onClick={() => handleButton({ type: "operator", value: "/" })}
              aria-label="Divide"
            >
              ÷
            </button>

            <button
              type="button"
              className="btn btn-digit"
              onClick={() => handleButton({ type: "digit", value: "7" })}
              aria-label="7"
            >
              7
            </button>
            <button
              type="button"
              className="btn btn-digit"
              onClick={() => handleButton({ type: "digit", value: "8" })}
              aria-label="8"
            >
              8
            </button>
            <button
              type="button"
              className="btn btn-digit"
              onClick={() => handleButton({ type: "digit", value: "9" })}
              aria-label="9"
            >
              9
            </button>
            <button
              type="button"
              className="btn btn-op"
              onClick={() => handleButton({ type: "operator", value: "*" })}
              aria-label="Multiply"
            >
              ×
            </button>

            <button
              type="button"
              className="btn btn-digit"
              onClick={() => handleButton({ type: "digit", value: "4" })}
              aria-label="4"
            >
              4
            </button>
            <button
              type="button"
              className="btn btn-digit"
              onClick={() => handleButton({ type: "digit", value: "5" })}
              aria-label="5"
            >
              5
            </button>
            <button
              type="button"
              className="btn btn-digit"
              onClick={() => handleButton({ type: "digit", value: "6" })}
              aria-label="6"
            >
              6
            </button>
            <button
              type="button"
              className="btn btn-op"
              onClick={() => handleButton({ type: "operator", value: "-" })}
              aria-label="Subtract"
            >
              −
            </button>

            <button
              type="button"
              className="btn btn-digit"
              onClick={() => handleButton({ type: "digit", value: "1" })}
              aria-label="1"
            >
              1
            </button>
            <button
              type="button"
              className="btn btn-digit"
              onClick={() => handleButton({ type: "digit", value: "2" })}
              aria-label="2"
            >
              2
            </button>
            <button
              type="button"
              className="btn btn-digit"
              onClick={() => handleButton({ type: "digit", value: "3" })}
              aria-label="3"
            >
              3
            </button>
            <button
              type="button"
              className="btn btn-op"
              onClick={() => handleButton({ type: "operator", value: "+" })}
              aria-label="Add"
            >
              +
            </button>

            <button
              type="button"
              className="btn btn-fn"
              onClick={() => handleButton({ type: "backspace" })}
              aria-label="Backspace"
            >
              ⌫
            </button>
            <button
              type="button"
              className="btn btn-digit btn-zero"
              onClick={() => handleButton({ type: "digit", value: "0" })}
              aria-label="0"
            >
              0
            </button>
            <button
              type="button"
              className="btn btn-digit"
              onClick={() => handleButton({ type: "decimal" })}
              aria-label="Decimal point"
            >
              .
            </button>
            <button
              type="button"
              className="btn btn-eq"
              onClick={() => handleButton({ type: "equals" })}
              aria-label="Equals"
              data-testid="btn-equals"
            >
              =
            </button>
          </div>

          <div className="calc-footer" aria-hidden="true">
            <div className="calc-meta">
              <span className="pill">Modern light</span>
              <span className="pill">Responsive</span>
              <span className="pill">Last: {lastKey ?? "-"}</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
