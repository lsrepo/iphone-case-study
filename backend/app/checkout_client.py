import httpx


class CheckoutComClient:
    def __init__(self, secret_key: str, base_url: str, processing_channel_id: str | None = None) -> None:
        self._secret_key = secret_key
        self._base_url = base_url
        self._processing_channel_id = processing_channel_id

    async def create_payment_session(
        self,
        *,
        amount: int,
        currency: str,
        country: str,
        reference: str,
        success_url: str,
        failure_url: str,
    ) -> dict:
        payload = {
            "amount": amount,
            "currency": currency,
            "reference": reference,
            "display_name": "iPhone Case Study",
            "billing": {"address": {"country": country}},
            "customer": {"name": "Guest Customer", "email": "guest@example.com"},
            "success_url": success_url,
            "failure_url": failure_url,
        }
        if self._processing_channel_id:
            payload["processing_channel_id"] = self._processing_channel_id

        async with httpx.AsyncClient(base_url=self._base_url) as client:
            response = await client.post(
                "/payment-sessions",
                json=payload,
                headers={"Authorization": f"Bearer {self._secret_key}"},
            )
        response.raise_for_status()
        return response.json()

    async def get_payment(self, payment_id: str) -> dict:
        async with httpx.AsyncClient(base_url=self._base_url) as client:
            response = await client.get(
                f"/payments/{payment_id}",
                headers={"Authorization": f"Bearer {self._secret_key}"},
            )
        response.raise_for_status()
        return response.json()
