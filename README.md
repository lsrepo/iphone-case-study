# iPhone Case Study — Checkout Integration

A cart + checkout flow for an iPhone-case merchant selling in Hong Kong (HKD) and
the Netherlands (EUR), using Checkout.com's Flow to accept cards and Apple Pay
without the backend ever seeing raw card data.

## Stack

- `backend/` — FastAPI. Holds the Checkout.com secret key, creates Payment
  Sessions, verifies and processes webhooks. In-memory order store (resets on
  restart — this is a local demo, not a production order system).
- `frontend/` — Next.js (App Router, TypeScript). Cart, checkout, and success
  pages. Mounts Checkout.com's Flow component client-side with the public key.

## Prerequisites

- Python 3.11+
- Node.js 20+
- A Checkout.com sandbox account with a public key, secret key, and webhook
  signing secret.

## Setup

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env: fill in CHECKOUT_SECRET_KEY and CHECKOUT_WEBHOOK_SECRET
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# edit .env.local: fill in NEXT_PUBLIC_CHECKOUT_COM_PUBLIC_KEY
npm run dev
```

Open http://localhost:3000 — it redirects to `/cart`.

### 3. Order status: how the success page knows the outcome

Checkout.com Flow reports the outcome directly to the browser — there's no
polling and no webhook needed for the customer-facing flow:

- A successful payment fires Flow's `onPaymentCompleted` callback with the
  payment ID (`status` is always `"Approved"` there — Flow only calls this on
  success).
- A declined card fires `onError` with `code: "payment_request_declined"`,
  which carries the payment ID and a decline reason (e.g.
  `not_enough_funds`, `try_again`).

The checkout page redirects straight to `/checkout/success` with the outcome
already known (`outcome=success` or `outcome=failure&reason=...`), so that
page just renders it — it doesn't ask the backend and wait.

**Webhooks are optional**, for backend record-keeping only (e.g. if
Checkout.com redirects the browser back after a 3DS challenge without going
through Flow's callbacks, or if you want the backend's order store to reflect
the outcome asynchronously). `POST /api/webhooks/checkout` handles this if
you set it up: expose your backend with a tunnel, add
`https://<your-tunnel>/api/webhooks/checkout` as a webhook endpoint in the
Checkout.com sandbox Dashboard, subscribe to `payment_approved`,
`payment_captured`, `payment_declined`, `payment_failed`, `payment_expired`,
and copy the signing secret into `backend/.env` as `CHECKOUT_WEBHOOK_SECRET`.
`scripts/start-tunnel.sh` automates the tunnel side of this — run
`scripts/start-tunnel.sh --help` for options. None of this is required to see
the success/failure page work locally.

## Running the tests

```bash
(cd backend && pytest)
(cd frontend && npm test)
```

## Testing a real sandbox payment

1. With both servers running, go to http://localhost:3000/, add a product,
   and click "Proceed to checkout".
2. **Card:** use a Checkout.com test card (e.g. `4242 4242 4242 4242`, any
   future expiry, any CVC) in the Flow card form. Use a decline test card
   (e.g. `4000 0000 0000 0002`) to see the failure path.
3. **Apple Pay:** only appears in Safari on a device with Apple Pay set up
   (real or simulator with a sandbox tester Apple ID signed in). It also
   requires the sandbox account to have Apple Pay configured (Apple Merchant
   ID, processing certificate, domain verification) — see "Apple Pay setup"
   below.
4. After paying, you land on `/checkout/success` immediately — the outcome
   came from Flow itself, not from a poll or a webhook (see "Order status:
   how the success page knows the outcome" above).

## Apple Pay setup (account-level, not code)

Apple Pay won't appear in Flow until, in the Checkout.com Dashboard:
- An Apple Merchant ID and processing certificate are registered.
- Your domain (or `localhost` tunnel domain, for testing) is verified for
  Apple Pay.

This is a one-time account configuration step outside this codebase.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `CHECKOUT_SECRET_KEY` | `backend/.env` | Authenticates server-side calls to Checkout.com |
| `CHECKOUT_WEBHOOK_SECRET` | `backend/.env` | Verifies the `Cko-Signature` header on incoming webhooks |
| `CHECKOUT_PROCESSING_CHANNEL_ID` | `backend/.env` | Only needed if your sandbox account has more than one processing channel |
| `CHECKOUT_API_BASE_URL` | `backend/.env` | Defaults to the sandbox API; don't point at production |
| `FRONTEND_BASE_URL` | `backend/.env` | Used to build the success/failure redirect URLs sent to Checkout.com |
| `NEXT_PUBLIC_API_BASE_URL` | `frontend/.env.local` | Where the frontend calls the backend |
| `NEXT_PUBLIC_CHECKOUT_COM_PUBLIC_KEY` | `frontend/.env.local` | Public key used to mount Flow client-side |

Real values (even sandbox ones) only ever go in `.env` / `.env.local`, both
gitignored. If this repo is ever made public or shared beyond the immediate
team, rotate the sandbox keys first.

## Scope notes

- v1 supports cards and Apple Pay only (see PRD §8 for what's out of scope:
  iDEAL, UnionPay, Alipay, multi-language localization, real payment
  processing).
- Market (HK/NL) is picked with a manual toggle on the cart page — there's no
  geo-detection.
- Customer name/email sent to Checkout.com are placeholders; there's no
  guest-checkout form in v1.
- Orders live in backend process memory and are lost on restart.
