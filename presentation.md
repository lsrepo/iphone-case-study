# Additional payment methods

## WeChat Pay and Alipay: implemented, but can't be tested end-to-end

Unlike Apple Pay, these aren't blocked on an external identity/enrollment
step — they're implemented and ready, but not verifiable in this
environment because they're not enabled on this Checkout.com sandbox
account (confirmed empirically: `payment_methods` in the session response
only ever returns `card`, `applepay`, `googlepay`, regardless of what's
sent in the request). Enabling them is a Checkout.com Dashboard action,
which this environment doesn't have access to — the same class of blocker
as the webhook registration and Apple Pay's account setup.

**What's actually implemented:**

- [`checkout_client.py`](backend/app/checkout_client.py) now sends
  `payment_type: "Regular"` and a full `items[]` array (product name,
  quantity, unit price) on every session — both are documented
  prerequisites for WeChat Pay, Alipay, and PayPal to be considered
  eligible for a session at all. Card/Apple Pay/Google Pay are unaffected
  by this (verified live — all three still appear after the change).
- Flow itself needs no code change to *display* these methods — it
  auto-detects and renders whatever's in the session's `payment_methods`,
  the same mechanism already rendering card/Apple Pay/Google Pay. The
  moment the account has them enabled, they'll appear with zero further
  code changes.
- **The part that does need code, and is the reason this matters**: WeChat
  Pay and Alipay show the customer a QR code to scan with their phone —
  the payment completes entirely outside the browser tab, so Flow's
  `onPaymentCompleted`/`onError` callbacks never fire for them (see "Why
  webhook is needed" below). [`checkout/page.tsx`](frontend/app/checkout/page.tsx)
  now polls `GET /api/payments/{order_id}` in the background once a
  session exists, as a fallback for exactly this case — if the backend's
  order status is ever updated (by a webhook) to `paid`/`declined`/`failed`,
  the poll redirects to the outcome page itself. For card/Apple Pay/Google
  Pay this poll never gets a chance to matter, since their own callback
  resolves and navigates away first — confirmed live, the poll runs
  harmlessly in the background returning `pending` the whole time a card
  payment completes through its normal fast path.

**Why this still can't complete a real payment here**: even with the
polling fallback wired up, `CHECKOUT_WEBHOOK_SECRET` is a placeholder and
no tunnel is registered (see "Order status: how the success page knows the
outcome" in [README.md](README.md)) — and the methods aren't enabled on the
account regardless. Both are needed; neither is achievable from this
environment.

### Why webhook is needed for these payment methods (and not for card/Apple Pay/Google Pay)

It comes down to where the payment actually gets completed:

- **Card, Apple Pay, Google Pay** resolve inside the same browser tab Flow
  is running in — a native payment sheet appears over the page, the
  customer confirms, and the browser hands the result straight back to
  Flow's JS callback. The page witnessed the entire transaction.
- **WeChat Pay / Alipay** show a QR code, and the customer completes the
  payment in a **separate app on their phone**. Nothing the browser tab is
  running has any connection to that app. The confirmation happens purely
  between the customer's wallet and Checkout.com's servers — the browser
  tab is just sitting there displaying a QR code, blind to what happens
  next. There's no synchronous signal for the SDK to hand back, because
  nothing in the page witnessed the payment complete. The only channel
  left for the backend to learn the outcome is Checkout.com's server
  pushing an event to it after the fact — a webhook. This isn't a design
  choice Checkout.com could route around; it's a direct consequence of the
  payment happening on a different device entirely.

# Apple Pay: why it isn't enabled

Apple Pay is already requested in the code — it shows up in the payment
session's `payment_methods` alongside card, and Flow renders it automatically
the moment the account-level setup below is complete. Nothing in this repo
needs to change for Apple Pay to start working. It doesn't show up today
because of external account requirements outside this codebase, not a bug.

## The blocker: it needs an Apple Developer account, not just a Checkout.com sandbox

Apple Pay setup is controlled by Apple, not Checkout.com. Checkout.com's own
setup guide is explicit that this applies to **both sandbox and production**:

> "You must create separate merchant IDs for your sandbox and production
> environments."

"Sandbox" only means the money isn't real — Apple's identity and domain
verification requirements are identical either way. There's no sandbox-only
shortcut that skips them.

Concretely, an Apple Developer account is required to:

1. **Create an Apple Merchant ID** — done in the Apple Developer portal.
2. **Create an Apple Pay Payment Processing Certificate** — Checkout.com
   generates a certificate signing request (CSR) via their API, but Apple's
   portal is what turns that CSR into a signed certificate.
3. **Register and verify a domain** — Apple's portal issues a verification
   file that must be hosted at
   `https://yourdomain.com/.well-known/apple-developer-merchantid-domain-association`
   on a real HTTPS domain (not `localhost`).
4. **Create a separate Merchant Identity certificate and private key** — also
   generated through Apple's portal, used to validate Apple Pay sessions.

An Apple Developer account requires Apple ID enrollment, identity/business
verification, and an annual fee (~$99/year). This is a real-world identity
and payment step tied to a person or company — not something that can be
scripted, faked, or done on someone else's behalf.

## What is and isn't achievable from here

| Step | Who does it |
|---|---|
| Generate the CSR | Checkout.com API — can be done from this repo, secret key already configured |
| Create the Merchant ID | Apple Developer portal — requires an Apple Developer account |
| Turn the CSR into a signed certificate | Apple Developer portal — requires an Apple Developer account |
| Upload the signed certificate back to Checkout.com | Checkout.com API — can be done from this repo |
| Register + verify the domain | Apple Developer portal — requires an Apple Developer account |
| Host the domain verification file | This repo's `frontend/public/.well-known/` — can be done from this repo, once Apple issues the file |
| Create the Merchant Identity certificate + key | Apple Developer portal — requires an Apple Developer account |

Four of the seven steps are hard-blocked on an Apple Developer account that
doesn't currently exist for this project. The remaining three are already
achievable in this codebase and will take minutes once that account exists.

## What would unblock it

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) (or get added to an existing organization's account).
2. Come back and work through the "Set up Apple Pay" steps in
   [Checkout.com's Payment Setup API guide](https://www.checkout.com/docs/payments/add-payment-methods/apple-pay/payment-setup-api).

## Testing note

Even once account-level setup is complete, Apple Pay only renders in Safari
on a device with Apple Pay configured (a real device, or a Mac/iOS
simulator signed into a sandbox tester Apple ID) — it will never appear in
a Chromium-based browser, which is why it hasn't been visible during testing
in this environment regardless of the account-level blocker above.
