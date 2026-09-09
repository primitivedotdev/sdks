from __future__ import annotations

import json
from uuid import UUID

import httpx
import pytest

from primitive.api.api.endpoints import (
    complete_webhook_event,
    create_endpoint,
    pull_webhook_event,
    update_endpoint,
)
from primitive.api.client import Client
from primitive.api.models.complete_webhook_exec_input import CompleteWebhookExecInput
from primitive.api.models.complete_webhook_exec_input_mode import (
    CompleteWebhookExecInputMode,
)
from primitive.api.models.create_endpoint_input import CreateEndpointInput
from primitive.api.models.create_endpoint_input_kind import CreateEndpointInputKind
from primitive.api.models.create_endpoint_input_rules import CreateEndpointInputRules
from primitive.api.models.create_endpoint_response_200 import CreateEndpointResponse200
from primitive.api.models.error_response import ErrorResponse
from primitive.api.models.pull_webhook_input import PullWebhookInput
from primitive.api.models.pull_webhook_response import PullWebhookResponse
from primitive.api.models.update_endpoint_input import UpdateEndpointInput

ENDPOINT_ID = UUID("11111111-1111-4111-8111-111111111111")
EVENT_ID = UUID("22222222-2222-4222-8222-222222222222")


def test_named_subscription_resume_does_not_send_unrequested_settings() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/endpoints"
        assert json.loads(request.content) == {"kind": "pull", "name": "my-agent"}
        return httpx.Response(200, json={"success": True})

    with Client(
        base_url="https://example.test",
        httpx_args={"transport": httpx.MockTransport(handler)},
    ) as client:
        result = create_endpoint.sync(
            client=client,
            body=CreateEndpointInput(
                kind=CreateEndpointInputKind.PULL, name="my-agent"
            ),
        )
    assert isinstance(result, CreateEndpointResponse200)


def test_explicit_endpoint_settings_and_existing_rules_are_preserved() -> None:
    rules = {"event_types": ["email.received"], "exclude_attachments": True}
    body = CreateEndpointInput(
        enabled=False,
        is_route_target=False,
        rules=CreateEndpointInputRules.from_dict(rules),
    ).to_dict()
    assert body["enabled"] is False
    assert body["is_route_target"] is False
    assert body["rules"] == rules


@pytest.mark.parametrize("empty", [False, True])
def test_pull_preserves_exact_body_headers_and_nullable_delivery(empty: bool) -> None:
    raw_body = '{ "type": "email.received", "text": "caf\u00e9", "escaped": "\\n" }\n'
    headers = {
        "Primitive-Signature": "fixture-signature",
        "X-Primitive-Email-Id": str(EVENT_ID),
    }
    delivery = (
        None
        if empty
        else {
            "queue_id": str(ENDPOINT_ID),
            "event_id": str(EVENT_ID),
            "event_type": "email.received",
            "delivery_id": str(ENDPOINT_ID),
            "lease_token": str(EVENT_ID),
            "lease_expires_at": "2026-01-01T00:01:00Z",
            "body": raw_body,
            "headers": headers,
        }
    )

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == f"/endpoints/{ENDPOINT_ID}/pull"
        assert json.loads(request.content) == {"wait_seconds": 0}
        return httpx.Response(
            200,
            json={
                "success": True,
                "data": {
                    "delivery": delivery,
                    "backlog": 0 if empty else 1,
                    "gap_count": 2,
                    "last_gap_reason": "retention_expired" if empty else None,
                    "retention_seconds": 86400,
                    "handler_timeout_seconds": 30,
                },
            },
        )

    with Client(
        base_url="https://example.test",
        httpx_args={"transport": httpx.MockTransport(handler)},
    ) as client:
        result = pull_webhook_event.sync(
            ENDPOINT_ID, client=client, body=PullWebhookInput(wait_seconds=0)
        )
    assert isinstance(result, PullWebhookResponse)
    assert result.data.gap_count == 2
    if empty:
        assert result.data.delivery is None
        assert result.data.last_gap_reason == "retention_expired"
    else:
        assert result.data.delivery is not None
        assert result.data.delivery.event_id == EVENT_ID
        assert result.data.delivery.body.encode("utf-8") == raw_body.encode("utf-8")
        assert result.data.delivery.headers.to_dict() == headers
        assert result.data.last_gap_reason is None


@pytest.mark.parametrize(
    "operation,status,code",
    [
        ("create", 409, "subscription_conflict"),
        ("create", 409, "subscription_limit"),
        ("create", 503, "pull_unavailable"),
        ("update", 409, "conflict"),
        ("pull", 408, "request_aborted"),
        ("pull", 409, "subscription_disabled"),
        ("pull", 409, "subscription_unavailable"),
        ("pull", 410, "event_content_unavailable"),
        ("pull", 503, "event_preparation_failed"),
        ("complete", 409, "stale_delivery"),
    ],
)
def test_receiving_returns_typed_operational_errors(
    operation: str, status: int, code: str
) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status,
            json={
                "success": False,
                "error": {"code": code, "message": "Event could not be offered."},
            },
        )

    with Client(
        base_url="https://example.test",
        raise_on_unexpected_status=True,
        httpx_args={"transport": httpx.MockTransport(handler)},
    ) as client:
        if operation == "create":
            result = create_endpoint.sync_detailed(
                client=client,
                body=CreateEndpointInput(
                    kind=CreateEndpointInputKind.PULL, name="my-agent"
                ),
            )
        elif operation == "update":
            result = update_endpoint.sync_detailed(
                ENDPOINT_ID,
                client=client,
                body=UpdateEndpointInput(url="https://example.test/webhook"),
            )
        elif operation == "complete":
            result = complete_webhook_event.sync_detailed(
                ENDPOINT_ID,
                client=client,
                body=CompleteWebhookExecInput(
                    queue_id=ENDPOINT_ID,
                    delivery_id=EVENT_ID,
                    lease_token=ENDPOINT_ID,
                    duration_ms=10,
                    mode=CompleteWebhookExecInputMode.EXEC,
                    exit_code=0,
                ),
            )
        else:
            result = pull_webhook_event.sync_detailed(
                ENDPOINT_ID, client=client, body=PullWebhookInput(wait_seconds=0)
            )
    assert result.status_code == status
    assert isinstance(result.parsed, ErrorResponse)
    assert result.parsed.error.code == code
