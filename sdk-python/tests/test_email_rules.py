import json
from pathlib import Path
from uuid import UUID

import httpx
import pytest

from primitive import PrimitiveAPIError, PrimitiveClient
from primitive.api.api.email_rules import compile_email_rule, get_email_rule
from primitive.api.client import Client
from primitive.api.models.compile_email_rule_request import CompileEmailRuleRequest
from primitive.api.models.error_response import ErrorResponse
from primitive.api.models.error_response_error_code import ErrorResponseErrorCode
from primitive.api.models.get_email_rule_response_200 import GetEmailRuleResponse200
from primitive.api.models.get_email_rule_result import GetEmailRuleResult
from primitive.api.models.get_email_rule_result_state import GetEmailRuleResultState

RULE_ID = UUID("3c9e7a1b-2d4f-4b6a-8c0e-1f2a3b4c5d6e")
BASE_URL = "https://example.test/api/v1"


def _fixture(*parts: str) -> dict[str, object]:
    current = Path(__file__).resolve()
    for root in (current.parents[2], current.parents[1]):
        candidate = root.joinpath("test-fixtures", *parts)
        if candidate.exists():
            return json.loads(candidate.read_text())
    raise FileNotFoundError("Could not locate shared test-fixtures directory")


def _client(response: httpx.Response) -> Client:
    return Client(
        base_url="https://example.test",
        raise_on_unexpected_status=True,
        httpx_args={"transport": httpx.MockTransport(lambda _request: response)},
    )


def test_get_email_rule_decodes_unfamiliar_state() -> None:
    # A value the API adds after this SDK was generated still decodes
    # instead of failing the whole response.
    body = _fixture("email-rules", "rule-detail.json")
    with _client(httpx.Response(200, json=body)) as connection:
        result = get_email_rule.sync_detailed(RULE_ID, client=connection)

    assert isinstance(result.parsed, GetEmailRuleResponse200)
    rule = result.parsed.data
    assert isinstance(rule, GetEmailRuleResult)
    assert isinstance(rule.state, GetEmailRuleResultState)
    assert rule.state == "some_future_state"
    assert rule.to_dict()["state"] == "some_future_state"
    assert rule.name == "Internship applicants"
    assert rule.current is not None
    assert rule.current.version == 2
    assert rule.current.compiled_by == "rule-compiler-v1"
    assert rule.current.tree.questions == [
        "Is the sender a college student looking for an internship?"
    ]


def test_a_known_state_is_still_the_enum_member() -> None:
    assert GetEmailRuleResultState("active") is GetEmailRuleResultState.ACTIVE


def test_a_value_of_the_wrong_type_is_still_refused() -> None:
    with pytest.raises(ValueError):
        GetEmailRuleResultState(7)


def _not_compiled(code: str) -> httpx.Response:
    return httpx.Response(
        422,
        json={
            "success": False,
            "error": {
                "code": code,
                "message": "Rephrase it.",
                "details": {"reason": "invalid"},
            },
        },
    )


def _compile(code: str) -> ErrorResponse:
    with _client(_not_compiled(code)) as connection:
        result = compile_email_rule.sync_detailed(
            client=connection,
            body=CompileEmailRuleRequest(
                english="college students looking for internships"
            ),
        )
    assert result.status_code == 422
    assert isinstance(result.parsed, ErrorResponse)
    return result.parsed


def test_compile_email_rule_decodes_not_compiled_error() -> None:
    parsed = _compile("email_rule_not_compiled")
    assert parsed.error.code == ErrorResponseErrorCode.EMAIL_RULE_NOT_COMPILED


def test_an_error_code_not_in_the_spec_still_decodes() -> None:
    parsed = _compile("some_future_code")
    assert parsed.error.code == "some_future_code"
    assert parsed.to_dict()["error"]["code"] == "some_future_code"


def test_the_client_raises_its_api_error_for_an_unlisted_code() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            409,
            json={
                "success": False,
                "error": {"code": "some_future_code", "message": "Later."},
            },
        )

    client = PrimitiveClient(
        "prim_test", api_base_url_1=BASE_URL, api_base_url_2=BASE_URL
    )
    transport = httpx.MockTransport(handler)
    client.api_client.set_httpx_client(
        httpx.Client(base_url=BASE_URL, transport=transport)
    )
    client.api_send_client.set_httpx_client(
        httpx.Client(base_url=BASE_URL, transport=transport)
    )

    with pytest.raises(PrimitiveAPIError) as caught:
        client.send(
            from_email="support@example.com",
            to="alice@example.com",
            subject="Hello",
            body_text="Hi there",
        )
    assert caught.value.code == "some_future_code"
    assert caught.value.status_code == 409
