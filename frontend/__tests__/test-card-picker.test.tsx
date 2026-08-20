// frontend/__tests__/test-card-picker.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TestCardPicker } from "../components/TestCardPicker";

describe("TestCardPicker", () => {
  it("shows no card details until an outcome is chosen", () => {
    render(<TestCardPicker />);
    expect(screen.queryByText(/card number/i)).not.toBeInTheDocument();
  });

  it("shows the card number, expiry, and CVV once an outcome is chosen", async () => {
    const user = userEvent.setup();
    render(<TestCardPicker />);

    await user.selectOptions(screen.getByLabelText(/sandbox test card/i), "insufficient-funds");

    expect(screen.getByText("4544249167673670")).toBeInTheDocument();
    expect(screen.getByText("12/30")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("copies the selected field to the clipboard and confirms it in the UI", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const user = userEvent.setup();
    render(<TestCardPicker />);

    await user.selectOptions(screen.getByLabelText(/sandbox test card/i), "approved");
    await user.click(screen.getAllByRole("button", { name: /^copy$/i })[0]);

    expect(await screen.findByRole("button", { name: /copied/i })).toBeInTheDocument();
  });
});
