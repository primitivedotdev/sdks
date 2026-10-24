import json
from http import HTTPStatus
from typing import Any

import httpx
import pytest

import primitive
from primitive import GrantForbiddenError, PrimitiveAPIError, PrimitiveClient

BASE_URL = "https://example.test/api/v1"


def _client_answering(status: int, body: dict[str, Any]) -> PrimitiveClient:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status,
            content=json.dumps(body).encode(),
            headers={"content-type": "application/json"},
        )

    client = PrimitiveClient("prim_test", api_base_url_1=BASE_URL, api_base_url_2=BASE_URL)
    transport = httpx.MockTransport(handler)
    client.api_client.set_httpx_client(httpx.Client(base_url=BASE_URL, transport=transport))
    client.api_send_client.set_httpx_client(
        httpx.Client(base_url=BASE_URL, transport=transport)
    )
    return client


def _send(client: PrimitiveClient) -> None:
    client.send(
        from_email="support@example.com",
        to="alice@example.com",
        subject="Hello",
        body_text="Hi there",
    )


def test_grant_forbidden_raises_typed_error() -> None:
    client = _client_answering(
        HTTPStatus.FORBIDDEN,
        {
            "success": False,
            "error": {
                "code": "grant_forbidden",
                "message": "This credential's grant does not allow this operation.",
                "details": {
                    "permission": "mail:send",
                    "credential_kind": "org_key",
                    "credential_grant_id": "g1",
                    "catalog_version": "c1",
                    "reason": "resource_outside_grant",
                    "missing": "mail:read",
                    "resource": {"type": "domain", "id": "d1"},
                },
            },
        },
    )
    with pytest.raises(GrantForbiddenError) as caught:
        _send(client)
    error = caught.value
    assert isinstance(error, PrimitiveAPIError)
    assert error.status_code == 403
    assert error.code == primitive.GRANT_FORBIDDEN_CODE
    assert error.permission == "mail:send"
    assert error.credential_kind == "org_key"
    assert error.credential_grant_id == "g1"
    assert error.grant_template_key is None
    assert error.catalog_version == "c1"
    assert error.reason == "resource_outside_grant"
    assert error.missing == "mail:read"
    assert error.resource == {"type": "domain", "id": "d1"}
    assert error.details is not None and error.details["permission"] == "mail:send"


def test_other_forbidden_stays_plain() -> None:
    client = _client_answering(
        HTTPStatus.FORBIDDEN,
        {"success": False, "error": {"code": "forbidden", "message": "Insufficient permissions"}},
    )
    with pytest.raises(PrimitiveAPIError) as caught:
        _send(client)
    assert not isinstance(caught.value, GrantForbiddenError)
    assert caught.value.code == "forbidden"


def test_grant_forbidden_without_details() -> None:
    error = GrantForbiddenError("refused", status_code=403, details=None)
    assert error.code == "grant_forbidden"
    assert error.permission is None
    assert error.resource is None


def test_builtin_role_keys_include_operator() -> None:
    from primitive.api.models import BuiltinRoleKey, Role

    assert [key.value for key in BuiltinRoleKey] == [
        "admin",
        "member",
        "operator",
        "owner",
    ]
    role = Role.from_dict(
        {
            "id": "r-operator",
            "key": "operator",
            "kind": "builtin",
            "name": "Operator",
            "permissions": ["mail:send"],
            "version": 1,
        }
    )
    assert BuiltinRoleKey(role.key) is BuiltinRoleKey.OPERATOR
    unlisted = Role.from_dict(
        {
            "id": "r-other",
            "key": "restricted",
            "kind": "builtin",
            "name": "Restricted",
            "permissions": [],
            "version": 1,
        }
    )
    assert unlisted.key == "restricted"
    assert "restricted" not in {key.value for key in BuiltinRoleKey}
