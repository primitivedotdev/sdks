from __future__ import annotations

# Round-trip test that pins the new fields on EmailDetail (replies,
# from_known_address, body_text, body_html). A future regen that
# drops one of these fields would silently break the SDK contract;
# this test fails loudly when that happens.
from primitive.api.models.email_detail import EmailDetail
from primitive.api.models.email_detail_reply import EmailDetailReply

SAMPLE = {
    "id": "00000000-0000-0000-0000-000000000001",
    "message_id": "<msg@example.com>",
    "domain_id": "11111111-1111-1111-1111-111111111111",
    "org_id": "22222222-2222-2222-2222-222222222222",
    "sender": "alice@example.com",
    "recipient": "support@example.com",
    "subject": "Hello",
    "body_text": "Hi there",
    "body_html": "<p>Hi there</p>",
    "status": "completed",
    "domain": "example.com",
    "spam_score": 0.0,
    "raw_size_bytes": 1234,
    "raw_sha256": "abc",
    "created_at": "2026-05-03T00:00:00.000Z",
    "received_at": "2026-05-03T00:00:00.000Z",
    "rejection_reason": None,
    "webhook_status": "fired",
    "webhook_attempt_count": 1,
    "webhook_last_attempt_at": None,
    "webhook_last_status_code": 200,
    "webhook_last_error": None,
    "webhook_fired_at": "2026-05-03T00:00:00.000Z",
    "smtp_helo": "mail.example.com",
    "smtp_mail_from": "alice@example.com",
    "smtp_rcpt_to": ["support@example.com"],
    "from_header": "Alice <alice@example.com>",
    "content_discarded_at": None,
    "content_discarded_by_delivery_id": None,
    "from_email": "alice@example.com",
    "to_email": "support@example.com",
    "from_known_address": True,
    "replies": [
        {
            "id": "33333333-3333-3333-3333-333333333333",
            "status": "submitted_to_agent",
            "to_address": "alice@example.com",
            "subject": "Re: Hello",
            "created_at": "2026-05-03T00:00:01.000Z",
            "queue_id": None,
        }
    ],
}


def test_email_detail_surfaces_body_text_and_body_html() -> None:
    detail = EmailDetail.from_dict(SAMPLE)
    assert detail.body_text == "Hi there"
    assert detail.body_html == "<p>Hi there</p>"


def test_email_detail_surfaces_from_known_address() -> None:
    detail = EmailDetail.from_dict(SAMPLE)
    assert detail.from_known_address is True


def test_email_detail_surfaces_replies_array() -> None:
    detail = EmailDetail.from_dict(SAMPLE)
    assert len(detail.replies) == 1
    reply = detail.replies[0]
    assert isinstance(reply, EmailDetailReply)
    assert str(reply.id) == "33333333-3333-3333-3333-333333333333"
    assert reply.subject == "Re: Hello"


def test_email_detail_round_trips_to_dict() -> None:
    # to_dict / from_dict round-trip preserves the new fields. Catches
    # a regen that adds a field to from_dict but forgets to_dict
    # (or vice versa).
    detail = EmailDetail.from_dict(SAMPLE)
    serialized = detail.to_dict()
    assert serialized["body_text"] == "Hi there"
    assert serialized["body_html"] == "<p>Hi there</p>"
    assert serialized["from_known_address"] is True
    assert len(serialized["replies"]) == 1
