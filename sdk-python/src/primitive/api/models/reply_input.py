from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.send_mail_attachment import SendMailAttachment





T = TypeVar("T", bound="ReplyInput")



@_attrs_define
class ReplyInput:
    """ Body shape for `/emails/{id}/reply`. Intentionally narrow:
    recipients (`to`), subject, and threading headers
    (`in_reply_to`, `references`) are derived server-side from
    the inbound row referenced by the path id and are rejected by
    `additionalProperties` if passed (returns 400).

    `from` IS allowed because of legitimate use cases (display-name
    addition, replying from a different verified outbound address,
    multi-team triage). Send-mail's per-send `canSendFrom` gate
    validates the from-domain regardless, so the override carries
    no extra privilege.

        Attributes:
            body_text (str | Unset): Plain-text reply body. At least one of body_text or body_html is required. The combined
                UTF-8 byte length of body_text and body_html must be at most 262144 bytes (same cap as send-mail).
            body_html (str | Unset): HTML reply body. At least one of body_text or body_html is required.
            from_ (str | Unset): Optional override for the reply's From header. Defaults to
                the inbound's recipient. Use to add a display name (`"Acme
                Support" <agent@company.com>`) or to reply from a different
                verified outbound address (e.g. multi-team routing where
                support@ triages to billing@). The from-domain must be a
                verified outbound domain for your org, same as send-mail.
            wait (bool | Unset): When true, wait for the first downstream SMTP delivery outcome before returning, mirroring
                the send-mail `wait` semantics.
            attachments (list[SendMailAttachment] | Unset): Inline attachments for this reply. Use
                https://api.primitive.dev/v1 for replies with attachments. Combined raw decoded attachment bytes must be at most
                31457280.
     """

    body_text: str | Unset = UNSET
    body_html: str | Unset = UNSET
    from_: str | Unset = UNSET
    wait: bool | Unset = UNSET
    attachments: list[SendMailAttachment] | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.send_mail_attachment import SendMailAttachment
        body_text = self.body_text

        body_html = self.body_html

        from_ = self.from_

        wait = self.wait

        attachments: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.attachments, Unset):
            attachments = []
            for attachments_item_data in self.attachments:
                attachments_item = attachments_item_data.to_dict()
                attachments.append(attachments_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if body_text is not UNSET:
            field_dict["body_text"] = body_text
        if body_html is not UNSET:
            field_dict["body_html"] = body_html
        if from_ is not UNSET:
            field_dict["from"] = from_
        if wait is not UNSET:
            field_dict["wait"] = wait
        if attachments is not UNSET:
            field_dict["attachments"] = attachments

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.send_mail_attachment import SendMailAttachment
        d = dict(src_dict)
        body_text = d.pop("body_text", UNSET)

        body_html = d.pop("body_html", UNSET)

        from_ = d.pop("from", UNSET)

        wait = d.pop("wait", UNSET)

        _attachments = d.pop("attachments", UNSET)
        attachments: list[SendMailAttachment] | Unset = UNSET
        if _attachments is not UNSET:
            attachments = []
            for attachments_item_data in _attachments:
                attachments_item = SendMailAttachment.from_dict(attachments_item_data)



                attachments.append(attachments_item)


        reply_input = cls(
            body_text=body_text,
            body_html=body_html,
            from_=from_,
            wait=wait,
            attachments=attachments,
        )

        return reply_input

