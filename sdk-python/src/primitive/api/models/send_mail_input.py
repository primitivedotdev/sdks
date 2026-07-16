from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.send_mail_attachment import SendMailAttachment





T = TypeVar("T", bound="SendMailInput")



@_attrs_define
class SendMailInput:
    """ 
        Attributes:
            from_ (str): RFC 5322 From header. The sender domain must be a verified outbound domain for your organization.
            to (str): Recipient address. Recipient eligibility depends on your account's outbound entitlements.
            subject (str): Subject line for the outbound message
            cc (list[str] | str | Unset): Carbon-copy recipients. Either a single address or an array of addresses. Each
                entry must be a single address; use the array form for multiple recipients. Cc recipients are visible to
                everyone who receives the message. The combined number of to, cc, and bcc recipients must not exceed 100.
            bcc (list[str] | str | Unset): Blind-carbon-copy recipients. Either a single address or an array of addresses.
                Each entry must be a single address; use the array form for multiple recipients. Bcc recipients receive the
                message but are not disclosed to the other recipients: no Bcc header is sent. The combined number of to, cc, and
                bcc recipients must not exceed 100.
            body_text (str | Unset): Plain-text message body. At least one of body_text or body_html is required. The
                combined UTF-8 byte length of body_text and body_html must be at most 262144 bytes.
            body_html (str | Unset): HTML message body. At least one of body_text or body_html is required. The combined
                UTF-8 byte length of body_text and body_html must be at most 262144 bytes.
            in_reply_to (str | Unset): Message-ID of the direct parent email when sending a threaded reply.
            references (list[str] | Unset): Full ordered message-id chain for the thread.
            attachments (list[SendMailAttachment] | Unset): Inline attachments. Send requests with attachments to
                https://api.primitive.dev/v1/send-mail. Combined raw decoded attachment bytes must be at most 31457280.
            wait (bool | Unset): When true, wait for the first downstream SMTP delivery outcome before returning.
            wait_timeout_ms (int | Unset): Maximum time to wait for a delivery outcome when wait is true. Defaults to 30000.
     """

    from_: str
    to: str
    subject: str
    cc: list[str] | str | Unset = UNSET
    bcc: list[str] | str | Unset = UNSET
    body_text: str | Unset = UNSET
    body_html: str | Unset = UNSET
    in_reply_to: str | Unset = UNSET
    references: list[str] | Unset = UNSET
    attachments: list[SendMailAttachment] | Unset = UNSET
    wait: bool | Unset = UNSET
    wait_timeout_ms: int | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.send_mail_attachment import SendMailAttachment
        from_ = self.from_

        to = self.to

        subject = self.subject

        cc: list[str] | str | Unset
        if isinstance(self.cc, Unset):
            cc = UNSET
        elif isinstance(self.cc, list):
            cc = self.cc


        else:
            cc = self.cc

        bcc: list[str] | str | Unset
        if isinstance(self.bcc, Unset):
            bcc = UNSET
        elif isinstance(self.bcc, list):
            bcc = self.bcc


        else:
            bcc = self.bcc

        body_text = self.body_text

        body_html = self.body_html

        in_reply_to = self.in_reply_to

        references: list[str] | Unset = UNSET
        if not isinstance(self.references, Unset):
            references = self.references



        attachments: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.attachments, Unset):
            attachments = []
            for attachments_item_data in self.attachments:
                attachments_item = attachments_item_data.to_dict()
                attachments.append(attachments_item)



        wait = self.wait

        wait_timeout_ms = self.wait_timeout_ms


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "from": from_,
            "to": to,
            "subject": subject,
        })
        if cc is not UNSET:
            field_dict["cc"] = cc
        if bcc is not UNSET:
            field_dict["bcc"] = bcc
        if body_text is not UNSET:
            field_dict["body_text"] = body_text
        if body_html is not UNSET:
            field_dict["body_html"] = body_html
        if in_reply_to is not UNSET:
            field_dict["in_reply_to"] = in_reply_to
        if references is not UNSET:
            field_dict["references"] = references
        if attachments is not UNSET:
            field_dict["attachments"] = attachments
        if wait is not UNSET:
            field_dict["wait"] = wait
        if wait_timeout_ms is not UNSET:
            field_dict["wait_timeout_ms"] = wait_timeout_ms

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.send_mail_attachment import SendMailAttachment
        d = dict(src_dict)
        from_ = d.pop("from")

        to = d.pop("to")

        subject = d.pop("subject")

        def _parse_cc(data: object) -> list[str] | str | Unset:
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                cc_type_1 = cast(list[str], data)

                return cc_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | str | Unset, data)

        cc = _parse_cc(d.pop("cc", UNSET))


        def _parse_bcc(data: object) -> list[str] | str | Unset:
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                bcc_type_1 = cast(list[str], data)

                return bcc_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | str | Unset, data)

        bcc = _parse_bcc(d.pop("bcc", UNSET))


        body_text = d.pop("body_text", UNSET)

        body_html = d.pop("body_html", UNSET)

        in_reply_to = d.pop("in_reply_to", UNSET)

        references = cast(list[str], d.pop("references", UNSET))


        _attachments = d.pop("attachments", UNSET)
        attachments: list[SendMailAttachment] | Unset = UNSET
        if _attachments is not UNSET:
            attachments = []
            for attachments_item_data in _attachments:
                attachments_item = SendMailAttachment.from_dict(attachments_item_data)



                attachments.append(attachments_item)


        wait = d.pop("wait", UNSET)

        wait_timeout_ms = d.pop("wait_timeout_ms", UNSET)

        send_mail_input = cls(
            from_=from_,
            to=to,
            subject=subject,
            cc=cc,
            bcc=bcc,
            body_text=body_text,
            body_html=body_html,
            in_reply_to=in_reply_to,
            references=references,
            attachments=attachments,
            wait=wait,
            wait_timeout_ms=wait_timeout_ms,
        )

        return send_mail_input

