from __future__ import annotations

import json

import httpx

from primitive.api.api.agent_connections import (
    create_agent_connection,
    list_agent_connections,
)
from primitive.api.client import AuthenticatedClient
from primitive.api.models.create_agent_connection_body import CreateAgentConnectionBody
from primitive.api.models.create_agent_connection_body_ownership_kind import (
    CreateAgentConnectionBodyOwnershipKind,
)
from primitive.api.models.list_agent_connections_response_200 import (
    ListAgentConnectionsResponse200,
)


def test_public_connection_list_preserves_inactive_owner_status() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert request.url.path == "/agent-connections"
        assert request.url.params["limit"] == "50"
        return httpx.Response(
            200,
            json={
                "success": True,
                "data": [
                    {
                        "address": "agent@example.test",
                        "name": "Agent",
                        "owner_address": "owner@example.test",
                        "status": "connected",
                        "created_at": "2026-09-29T00:00:00Z",
                        "updated_at": "2026-09-29T00:00:00Z",
                        "claimed_at": None,
                        "verified_at": None,
                        "last_seen_at": None,
                        "ownership_kind": "personal",
                        "owner_user_id": "user-1",
                        "owner_active": False,
                    }
                ],
            },
        )

    with AuthenticatedClient(
        base_url="https://example.test",
        token="test-token",
        httpx_args={"transport": httpx.MockTransport(handler)},
    ) as client:
        result = list_agent_connections.sync(client=client)

    assert isinstance(result, ListAgentConnectionsResponse200)
    assert result.data[0].ownership_kind.value == "personal"
    assert result.data[0].owner_user_id == "user-1"
    assert result.data[0].owner_active is False


def test_public_connection_create_serializes_explicit_ownership() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/agent-connections"
        assert json.loads(request.content) == {
            "name": "Agent",
            "ownership_kind": "personal",
        }
        return httpx.Response(
            400,
            json={"success": False, "error": {"code": "validation_error", "message": "Invalid request"}},
        )

    with AuthenticatedClient(
        base_url="https://example.test",
        token="test-token",
        httpx_args={"transport": httpx.MockTransport(handler)},
    ) as client:
        result = create_agent_connection.sync(
            client=client,
            body=CreateAgentConnectionBody(
                name="Agent",
                ownership_kind=CreateAgentConnectionBodyOwnershipKind.PERSONAL,
            ),
        )
    assert result is not None
