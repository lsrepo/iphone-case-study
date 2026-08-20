// frontend/lib/testCards.ts
//
// Real Checkout.com sandbox test cards — see
// https://www.checkout.com/docs/developer-resources/testing/test-cards
//
// Card number/expiry/CVV can't be filled programmatically: Flow's card
// fields live in a PCI-isolated iframe that intentionally has no API for a
// merchant page to set them (only cardholderName/email/phone can be
// prefilled). These are shown for the customer to copy into the form.

export interface TestCard {
  id: string;
  label: string;
  outcome: "approved" | "declined";
  responseCode: string;
  number: string;
  expiry: string;
  cvv: string;
}

export const TEST_CARDS: TestCard[] = [
  {
    id: "approved",
    label: "Approved",
    outcome: "approved",
    responseCode: "10000",
    number: "4242424242424242",
    expiry: "12/30",
    cvv: "100",
  },
  {
    id: "insufficient-funds",
    label: "Declined — Insufficient funds",
    outcome: "declined",
    responseCode: "20051",
    number: "4544249167673670",
    expiry: "12/30",
    cvv: "100",
  },
  {
    id: "invalid-transaction",
    label: "Declined — Invalid transaction",
    outcome: "declined",
    responseCode: "20012",
    number: "4024007103573027",
    expiry: "12/30",
    cvv: "100",
  },
  {
    id: "restricted-card",
    label: "Declined — Restricted card",
    outcome: "declined",
    responseCode: "20062",
    number: "4818924250131070",
    expiry: "12/30",
    cvv: "100",
  },
  {
    id: "suspected-fraud",
    label: "Declined — Suspected fraud",
    outcome: "declined",
    responseCode: "20059",
    number: "4897453568485113",
    expiry: "12/30",
    cvv: "100",
  },
  {
    id: "lost-card",
    label: "Declined — Lost card, pick up",
    outcome: "declined",
    responseCode: "30041",
    number: "4941202060999329",
    expiry: "12/30",
    cvv: "100",
  },
  {
    id: "stolen-card",
    label: "Declined — Stolen card, pick up",
    outcome: "declined",
    responseCode: "30043",
    number: "4539253655711767",
    expiry: "12/30",
    cvv: "100",
  },
];
