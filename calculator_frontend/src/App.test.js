import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders calculator display and keypad", () => {
  render(<App />);

  expect(screen.getByLabelText(/calculator/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/display/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/current value/i)).toHaveTextContent("0");

  // A couple of representative keys
  expect(screen.getByRole("button", { name: "7" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /equals/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /all clear/i })).toBeInTheDocument();
});
