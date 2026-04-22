from __future__ import annotations

import re
from http import HTTPStatus
from typing import Any, cast

from .api import DEFAULT_BASE_URL, AuthenticatedClient
from .api.api.sending.send_email import (
    asyncio_detailed as send_email_async_detailed,
)
from .api.api.sending.send_email import sync_detailed as send_email_sync_detailed
from .api.models.error_response import ErrorResponse
from .api.models.send_email_response_200 import SendEmailResponse200
from .api.models.send_input import SendInput
from .api.models.send_result import SendResult
from .api.types import UNSET

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _validate_email_address(field: str, value: str) -> None:
    if not EMAIL_REGEX.fullmatch(value):
        raise TypeError(f"{field} must be a valid email address")


def _build_send_input(
    *,
    from_email: str,
    to: str,
    subject: str,
    body: str,
) -> SendInput:
    _validate_email_address("from", from_email)
    _validate_email_address("to", to)

    if subject.strip() == "":
        raise TypeError("subject must be a non-empty string")

    if body == "":
        raise TypeError("body must be a non-empty string")

    return SendInput(
        from_=from_email,
        to=to,
        subject=subject,
        body=body,
    )


class PrimitiveAPIError(Exception):
    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        code: str | None = None,
        payload: Any = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.payload = payload


def _raise_api_error(status_code: int, parsed: Any) -> None:
    if isinstance(parsed, ErrorResponse):
        raise PrimitiveAPIError(
            parsed.error.message,
            status_code=status_code,
            code=parsed.error.code.value,
            payload=parsed.to_dict(),
        )

    raise PrimitiveAPIError(
        "Primitive API request failed",
        status_code=status_code,
        payload=parsed,
    )


class PrimitiveClient:
    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        **client_kwargs: Any,
    ) -> None:
        self.api_client = AuthenticatedClient(
            base_url=base_url,
            token=api_key,
            **client_kwargs,
        )

    def send(
        self,
        *,
        from_email: str,
        to: str,
        subject: str,
        body: str,
    ) -> SendResult:
        response = send_email_sync_detailed(
            client=self.api_client,
            body=_build_send_input(
                from_email=from_email,
                to=to,
                subject=subject,
                body=body,
            ),
        )

        if response.status_code == HTTPStatus.OK and isinstance(
            response.parsed,
            SendEmailResponse200,
        ):
            if response.parsed.data is UNSET:
                raise PrimitiveAPIError(
                    "Primitive API returned no send result",
                    status_code=int(response.status_code),
                    payload=response.content,
                )
            return cast(SendResult, response.parsed.data)

        _raise_api_error(int(response.status_code), response.parsed)
        raise AssertionError("unreachable")

    async def asend(
        self,
        *,
        from_email: str,
        to: str,
        subject: str,
        body: str,
    ) -> SendResult:
        response = await send_email_async_detailed(
            client=self.api_client,
            body=_build_send_input(
                from_email=from_email,
                to=to,
                subject=subject,
                body=body,
            ),
        )

        if response.status_code == HTTPStatus.OK and isinstance(
            response.parsed,
            SendEmailResponse200,
        ):
            if response.parsed.data is UNSET:
                raise PrimitiveAPIError(
                    "Primitive API returned no send result",
                    status_code=int(response.status_code),
                    payload=response.content,
                )
            return cast(SendResult, response.parsed.data)

        _raise_api_error(int(response.status_code), response.parsed)
        raise AssertionError("unreachable")


def create_client(
    api_key: str,
    *,
    base_url: str = DEFAULT_BASE_URL,
    **client_kwargs: Any,
) -> PrimitiveClient:
    return PrimitiveClient(api_key, base_url=base_url, **client_kwargs)


__all__ = [
    "PrimitiveAPIError",
    "PrimitiveClient",
    "SendInput",
    "SendResult",
    "create_client",
]
