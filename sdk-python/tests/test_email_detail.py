from __future__ import annotations

import datetime

# Round-trip test that pins the new fields on EmailDetail (replies,
# from_known_address, sender_connected_agent_verified, body_text, body_html). A future regen that
# drops one of these fields would silently break the SDK contract;
# this test fails loudly when that happens.
from primitive.api.models.email_detail import EmailDetail
from primitive.api.models.email_detail_awaiting import EmailDetailAwaiting
from primitive.api.models.email_detail_relay_type_0 import EmailDetailRelayType0
from primitive.api.models.email_detail_relay_type_0_delivery_item import (
    EmailDetailRelayType0DeliveryItem,
)
from primitive.api.models.email_detail_reply import EmailDetailReply
from primitive.api.types import UNSET, Unset

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
    "sender_connected_agent_verified": False,
    "thread_id": "44444444-4444-4444-4444-444444444444",
    "reply_count": 1,
    "last_replied_at": "2026-05-03T00:01:00Z",
    "awaiting": "them",
    "automated": True,
    "automated_reasons": ["list_unsubscribe", "list_id"],
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
    "parsed": {
        "status": "complete",
        "body_text": "Hi there",
        "body_html": "<p>Hi there</p>",
        "reply_to": None,
        "cc": [{"name": None, "address": "cc@example.com"}],
        "bcc": None,
        "to_addresses": [{"name": "Support", "address": "support@example.com"}],
        "in_reply_to": None,
        "references": None,
        "attachments": [],
    },
    "auth": {
        "spf": "pass",
        "dmarc": "pass",
        "dmarcPolicy": "reject",
        "dmarcFromDomain": "example.com",
        "dmarcSpfAligned": True,
        "dmarcDkimAligned": True,
        "dmarcSpfStrict": False,
        "dmarcDkimStrict": False,
        "dkimSignatures": [
            {
                "domain": "example.com",
                "selector": "default",
                "result": "pass",
                "aligned": True,
                "keyBits": 2048,
                "algo": "rsa-sha256",
            }
        ],
    },
}


def test_email_detail_surfaces_body_text_and_body_html() -> None:
    detail = EmailDetail.from_dict(SAMPLE)
    assert detail.body_text == "Hi there"
    assert detail.body_html == "<p>Hi there</p>"


def test_email_detail_surfaces_from_known_address() -> None:
    detail = EmailDetail.from_dict(SAMPLE)
    assert detail.from_known_address is True


def test_email_detail_surfaces_sender_connected_agent_proof() -> None:
    detail = EmailDetail.from_dict(SAMPLE)
    assert detail.sender_connected_agent_verified is False


def test_email_detail_surfaces_replies_array() -> None:
    detail = EmailDetail.from_dict(SAMPLE)
    assert len(detail.replies) == 1
    reply = detail.replies[0]
    assert isinstance(reply, EmailDetailReply)
    assert str(reply.id) == "33333333-3333-3333-3333-333333333333"
    assert reply.subject == "Re: Hello"


def test_email_detail_surfaces_thread_parsed_auth() -> None:
    detail = EmailDetail.from_dict(SAMPLE)
    assert str(detail.thread_id) == "44444444-4444-4444-4444-444444444444"
    assert detail.parsed.status == "complete"
    assert detail.auth.spf == "pass"


def test_email_detail_surfaces_automated_verdict() -> None:
    detail = EmailDetail.from_dict(SAMPLE)
    assert detail.automated is True
    assert detail.automated_reasons == ["list_unsubscribe", "list_id"]


def test_email_detail_surfaces_reply_state() -> None:
    detail = EmailDetail.from_dict(SAMPLE)
    assert detail.reply_count == 1
    assert detail.awaiting == EmailDetailAwaiting.THEM
    assert detail.last_replied_at is not None
    assert detail.last_replied_at.isoformat() == "2026-05-03T00:01:00+00:00"


def test_email_detail_round_trips_to_dict() -> None:
    # to_dict / from_dict round-trip preserves the new fields. Catches
    # a regen that adds a field to from_dict but forgets to_dict
    # (or vice versa).
    detail = EmailDetail.from_dict(SAMPLE)
    serialized = detail.to_dict()
    assert serialized["body_text"] == "Hi there"
    assert serialized["body_html"] == "<p>Hi there</p>"
    assert serialized["from_known_address"] is True
    assert serialized["sender_connected_agent_verified"] is False
    assert len(serialized["replies"]) == 1
    assert serialized["parsed"]["status"] == "complete"
    assert serialized["auth"]["spf"] == "pass"


def test_email_detail_relay_is_optional_and_nullable() -> None:
    absent = EmailDetail.from_dict(SAMPLE)
    assert absent.relay is UNSET
    assert "relay" not in absent.to_dict()

    null = EmailDetail.from_dict({**SAMPLE, "relay": None})
    assert null.relay is None
    assert null.to_dict()["relay"] is None

    relayed = EmailDetail.from_dict(
        {**SAMPLE, "relay": {"hostname": "relay.example.com", "via": "mail_relay"}}
    )
    assert isinstance(relayed.relay, EmailDetailRelayType0)
    assert relayed.relay.hostname == "relay.example.com"
    assert relayed.relay.via == "mail_relay"
    assert relayed.to_dict()["relay"] == {
        "hostname": "relay.example.com",
        "via": "mail_relay",
    }


def test_email_detail_relay_delivery_is_optional() -> None:
    relay = {"hostname": "relay.example.com", "via": "mail_relay"}

    without = EmailDetail.from_dict({**SAMPLE, "relay": relay})
    assert isinstance(without.relay, EmailDetailRelayType0)
    assert without.relay.delivery is UNSET
    assert "delivery" not in without.to_dict()["relay"]

    null = EmailDetail.from_dict({**SAMPLE, "relay": None})
    assert null.relay is None

    delivery = [
        {
            "recipient": "alice@example.org",
            "status": "delivered",
            "smtp_code": 250,
            "enhanced_status_code": "2.0.0",
            "smtp_response": "250 2.0.0 OK",
            "at": "2026-05-03T00:00:01Z",
        },
        {
            # An unfamiliar status parses: status is an open string.
            "recipient": "bob@example.org",
            "status": "quarantined",
            "smtp_code": None,
            "enhanced_status_code": None,
            "smtp_response": None,
            "at": "2026-05-03T00:00:02+00:00",
        },
    ]
    withd = EmailDetail.from_dict({**SAMPLE, "relay": {**relay, "delivery": delivery}})
    assert isinstance(withd.relay, EmailDetailRelayType0)
    items = withd.relay.delivery
    assert not isinstance(items, Unset)
    assert len(items) == 2
    first, second = items
    assert isinstance(first, EmailDetailRelayType0DeliveryItem)
    assert first.recipient == "alice@example.org"
    assert first.status == "delivered"
    assert first.smtp_code == 250
    assert first.enhanced_status_code == "2.0.0"
    assert first.smtp_response == "250 2.0.0 OK"
    assert first.at == datetime.datetime(2026, 5, 3, 0, 0, 1, tzinfo=datetime.UTC)
    assert second.status == "quarantined"
    assert second.smtp_code is None
    assert second.enhanced_status_code is None
    assert second.smtp_response is None

    serialized = withd.to_dict()["relay"]["delivery"]
    assert serialized[0]["status"] == "delivered"
    assert serialized[1]["status"] == "quarantined"
    assert serialized[1]["smtp_code"] is None
