from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="ReplyInput")



@_attrs_define
class ReplyInput:
    """ Body shape for `/emails/{id}/reply`. Intentionally narrow:
    recipients, sender, subject, and threading headers are derived
    server-side from the inbound row referenced by the path id.
    Passing any of `to`, `from`, `subject`, `in_reply_to`,
    `references`, or `reply_to` is rejected by `additionalProperties`
    (returns 400).

        Attributes:
            body_text (str | Unset): Plain-text reply body. At least one of body_text or body_html is required. The combined
                UTF-8 byte length of body_text and body_html must be at most 262144 bytes (same cap as send-mail).
            body_html (str | Unset): HTML reply body. At least one of body_text or body_html is required.
            wait (bool | Unset): When true, wait for the first downstream SMTP delivery outcome before returning, mirroring
                the send-mail `wait` semantics.
     """

    body_text: str | Unset = UNSET
    body_html: str | Unset = UNSET
    wait: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        body_text = self.body_text

        body_html = self.body_html

        wait = self.wait


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if body_text is not UNSET:
            field_dict["body_text"] = body_text
        if body_html is not UNSET:
            field_dict["body_html"] = body_html
        if wait is not UNSET:
            field_dict["wait"] = wait

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        body_text = d.pop("body_text", UNSET)

        body_html = d.pop("body_html", UNSET)

        wait = d.pop("wait", UNSET)

        reply_input = cls(
            body_text=body_text,
            body_html=body_html,
            wait=wait,
        )

        return reply_input

