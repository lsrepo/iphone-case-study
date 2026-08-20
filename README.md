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

### 3. Webhooks (needed for order status to update)

Checkout.com needs to reach `POST /api/webhooks/checkout` on your backend. For
local development, expose it with a tunnel and add
`https://<your-tunnel>/api/webhooks/checkout` as a webhook endpoint in the
Checkout.com sandbox Dashboard, subscribed to at least: `payment_approved`,
`payment_captured`, `payment_declined`, `payment_failed`, `payment_expired`.
Copy the webhook's signing secret into `backend/.env` as
`CHECKOUT_WEBHOOK_SECRET`.

`scripts/start-tunnel.sh` automates the tunnel side of this: it starts ngrok
for the backend (and the frontend, for Apple Pay), prints both HTTPS URLs, and
can write them straight into your `.env` files with `--update-env`. Requires
`ngrok` installed and authenticated once (`ngrok config add-authtoken ...`).
Run `scripts/start-tunnel.sh --help` for options.

If you're also tunneling the *frontend* (e.g. for Apple Pay testing, see
below), update `FRONTEND_BASE_URL` in `backend/.env` and
`NEXT_PUBLIC_API_BASE_URL` in `frontend/.env.local` to the tunnel's HTTPS
URLs too — not just the webhook endpoint — otherwise CORS will block the
frontend's calls to the backend.

## Running the tests

```bash
(cd backend && pytest)
(cd frontend && npm test)
```

## Testing a real sandbox payment

1. With both servers running (and the webhook tunnel active), go to
   http://localhost:3000/cart, add a product, and click "Proceed to checkout".
2. **Card:** use a Checkout.com test card (e.g. `4242 4242 4242 4242`, any
   future expiry, any CVC) in the Flow card form.
3. **Apple Pay:** only appears in Safari on a device with Apple Pay set up
   (real or simulator with a sandbox tester Apple ID signed in). It also
   requires the sandbox account to have Apple Pay configured (Apple Merchant
   ID, processing certificate, domain verification) — see "Apple Pay setup"
   below.
4. After paying, you land on `/checkout/success`, which polls the backend
   until the webhook has updated the order's status.

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
