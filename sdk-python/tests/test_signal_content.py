import json
from email.parser import BytesParser
from email.policy import SMTP, default
from pathlib import Path
from typing import Any

import pytest

from primitive.interactions import (
    SignalContentBodies,
    SignalContentInput,
    SignalContentInventory,
    SignalContentPart,
    classify_signal_content,
)

ROOT = Path(__file__).parents[2] / "test-fixtures"
FIXTURES = json.loads((ROOT / "signal-content.json").read_text())


@pytest.mark.parametrize("item", FIXTURES, ids=lambda item: item["name"])
def test_shared_signal_content(item: dict[str, Any]) -> None:
    supplied_parts = item["inventory"].get("parts")
    inventory = SignalContentInventory(
        item["inventory"]["status"],
        None
        if supplied_parts is None
        else tuple(
            SignalContentPart(part["filename"], part["contentType"])
            for part in supplied_parts
        ),
    )
    bodies = SignalContentBodies(**item["bodies"])
    raw = (
        bytes.fromhex(item["hex"])
        if "hex" in item
        else (item["source"] + " " * item.get("padding", 0)).encode()
        if "source" in item
        else None
    )
    result = classify_signal_content(SignalContentInput(inventory, bodies, raw))
    assert result.classification == item["classification"]
    assert result.reason == item["reason"]
    assert (result.interaction.status if result.interaction else None) == item[
        "interactionStatus"
    ]
    if result.interaction and result.interaction.status != "invalid":
        assert result.interaction.source_bytes == raw


def test_mime_round_trip_classification_preserves_attachment_source() -> None:
    message = BytesParser(policy=default).parsebytes(
        (ROOT / "signal-content.eml").read_bytes()
    )
    # Serialize and parse again through a real MIME implementation, not JSON alone.
    received = BytesParser(policy=default).parsebytes(message.as_bytes(policy=SMTP))
    parts = list(received.iter_attachments())
    assert len(parts) == 1
    raw = parts[0].get_payload(decode=True)
    assert isinstance(raw, bytes)
    text = received.get_body(preferencelist=("plain",))
    html = received.get_body(preferencelist=("html",))
    assert text is not None
    result = classify_signal_content(
        SignalContentInput(
            SignalContentInventory(
                "complete",
                tuple(
                    SignalContentPart(part.get_filename(), part.get_content_type())
                    for part in parts
                ),
            ),
            SignalContentBodies(
                "complete",
                text.get_content(),
                None if html is None else html.get_content(),
            ),
            raw,
        )
    )
    assert result.classification == "informational_only"
    assert result.interaction and result.interaction.source_bytes == raw
