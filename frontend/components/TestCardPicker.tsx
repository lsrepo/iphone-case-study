// frontend/components/TestCardPicker.tsx
"use client";

import { useState } from "react";
import { TEST_CARDS } from "../lib/testCards";

export function TestCardPicker() {
  const [selectedId, setSelectedId] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const selectedCard = TEST_CARDS.find((card) => card.id === selectedId) ?? null;

  async function handleCopy(field: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 1500);
    } catch {
      // Clipboard access can be denied by the browser — the value is still
      // shown on screen, so the customer can select and copy it manually.
    }
  }

  return (
    <div className="test-card-picker">
      <label htmlFor="test-card-select" className="test-card-label">
        Sandbox test card
      </label>
      <select id="test-card-select" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
        <option value="">Choose an outcome to test…</option>
        {TEST_CARDS.map((card) => (
          <option key={card.id} value={card.id}>
            {card.label}
          </option>
        ))}
      </select>

      {selectedCard && (
        <div className="test-card-details">
          <p className="test-card-note">
            Flow's card fields are PCI-isolated and can't be filled programmatically — copy each value into the form below.
          </p>
          <dl>
            <div className="test-card-field">
              <dt>Card number</dt>
              <dd>
                <code>{selectedCard.number}</code>
                <button type="button" onClick={() => handleCopy("number", selectedCard.number)}>
                  {copiedField === "number" ? "Copied" : "Copy"}
                </button>
              </dd>
            </div>
            <div className="test-card-field">
              <dt>Expiry</dt>
              <dd>
                <code>{selectedCard.expiry}</code>
                <button type="button" onClick={() => handleCopy("expiry", selectedCard.expiry)}>
                  {copiedField === "expiry" ? "Copied" : "Copy"}
                </button>
              </dd>
            </div>
            <div className="test-card-field">
              <dt>CVV</dt>
              <dd>
                <code>{selectedCard.cvv}</code>
                <button type="button" onClick={() => handleCopy("cvv", selectedCard.cvv)}>
                  {copiedField === "cvv" ? "Copied" : "Copy"}
                </button>
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
