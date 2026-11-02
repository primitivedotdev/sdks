import json
from pathlib import Path
from uuid import UUID

import httpx

from primitive.api.api.email_rules import compile_email_rule, get_email_rule
from primitive.api.client import Client
from primitive.api.models.compile_email_rule_input import CompileEmailRuleInput
from primitive.api.models.email_rule_detail import EmailRuleDetail
from primitive.api.models.error_response import ErrorResponse
from primitive.api.models.error_response_error_code import ErrorResponseErrorCode
from primitive.api.models.get_email_rule_response_200 import GetEmailRuleResponse200

RULE_ID = UUID("3c9e7a1b-2d4f-4b6a-8c0e-1f2a3b4c5d6e")


def _fixture(*parts: str) -> object:
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
    # A rule state is a plain string, so a state added after this SDK was
    # built still decodes instead of failing the whole response.
    body = _fixture("email-rules", "rule-detail.json")
    with _client(httpx.Response(200, json=body)) as connection:
        result = get_email_rule.sync_detailed(RULE_ID, client=connection)

    assert isinstance(result.parsed, GetEmailRuleResponse200)
    rule = result.parsed.data
    assert isinstance(rule, EmailRuleDetail)
    assert rule.state == "some_future_state"
    assert rule.name == "Internship applicants"
    assert rule.current is not None
    assert rule.current.version == 2
    assert rule.current.compiled_by == "rule-compiler-v1"
    assert rule.current.tree.questions == [
        "Is the sender a college student looking for an internship?"
    ]


def test_compile_email_rule_decodes_not_compiled_error() -> None:
    response = httpx.Response(
        422,
        json={
            "success": False,
            "error": {
                "code": "email_rule_not_compiled",
                "message": "Rephrase it.",
                "details": {"reason": "invalid"},
            },
        },
    )
    with _client(response) as connection:
        result = compile_email_rule.sync_detailed(
            client=connection,
            body=CompileEmailRuleInput(
                english="college students looking for internships"
            ),
        )

    assert result.status_code == 422
    assert isinstance(result.parsed, ErrorResponse)
    assert result.parsed.error.code == ErrorResponseErrorCode.EMAIL_RULE_NOT_COMPILED
