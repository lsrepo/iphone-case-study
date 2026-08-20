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
