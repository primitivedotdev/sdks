from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.parsed_email_data_status import ParsedEmailDataStatus
from typing import cast

if TYPE_CHECKING:
  from ..models.email_address import EmailAddress
  from ..models.email_attachment import EmailAttachment
  from ..models.parsed_email_data_error_type_0 import ParsedEmailDataErrorType0





T = TypeVar("T", bound="ParsedEmailData")



@_attrs_define
class ParsedEmailData:
    """ Parsed MIME content for an inbound email. Mirrors the
    `email.parsed` object on the webhook payload so a single parser
    handles both surfaces. `status` is `complete` when parsing
    succeeded; on `failed` the body/address/attachment fields are
    absent and `error` describes why.

        Attributes:
            status (ParsedEmailDataStatus):
            body_text (None | str | Unset): Plain-text body. Present when `status` is `complete`.
            body_html (None | str | Unset): HTML body. Present when `status` is `complete`.
            reply_to (list[EmailAddress] | None | Unset): Parsed `Reply-To` header addresses.
            cc (list[EmailAddress] | None | Unset): Parsed `Cc` header addresses.
            bcc (list[EmailAddress] | None | Unset): Parsed `Bcc` header addresses (rarely present on inbound).
            to_addresses (list[EmailAddress] | None | Unset): Parsed `To` header addresses.
            in_reply_to (list[str] | None | Unset): Message-IDs from the `In-Reply-To` header.
            references (list[str] | None | Unset): Message-IDs from the `References` header.
            attachments (list[EmailAttachment] | Unset): Attachment metadata. Empty array when none.
            error (None | ParsedEmailDataErrorType0 | Unset): Present (non-null) only when `status` is `failed`. When
                present, all three fields are populated, so a consumer can
                branch on `code` without defensive null checks.
     """

    status: ParsedEmailDataStatus
    body_text: None | str | Unset = UNSET
    body_html: None | str | Unset = UNSET
    reply_to: list[EmailAddress] | None | Unset = UNSET
    cc: list[EmailAddress] | None | Unset = UNSET
    bcc: list[EmailAddress] | None | Unset = UNSET
    to_addresses: list[EmailAddress] | None | Unset = UNSET
    in_reply_to: list[str] | None | Unset = UNSET
    references: list[str] | None | Unset = UNSET
    attachments: list[EmailAttachment] | Unset = UNSET
    error: None | ParsedEmailDataErrorType0 | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_address import EmailAddress
        from ..models.email_attachment import EmailAttachment
        from ..models.parsed_email_data_error_type_0 import ParsedEmailDataErrorType0
        status = self.status.value

        body_text: None | str | Unset
        if isinstance(self.body_text, Unset):
            body_text = UNSET
        else:
            body_text = self.body_text

        body_html: None | str | Unset
        if isinstance(self.body_html, Unset):
            body_html = UNSET
        else:
            body_html = self.body_html

        reply_to: list[dict[str, Any]] | None | Unset
        if isinstance(self.reply_to, Unset):
            reply_to = UNSET
        elif isinstance(self.reply_to, list):
            reply_to = []
            for reply_to_type_0_item_data in self.reply_to:
                reply_to_type_0_item = reply_to_type_0_item_data.to_dict()
                reply_to.append(reply_to_type_0_item)


        else:
            reply_to = self.reply_to

        cc: list[dict[str, Any]] | None | Unset
        if isinstance(self.cc, Unset):
            cc = UNSET
        elif isinstance(self.cc, list):
            cc = []
            for cc_type_0_item_data in self.cc:
                cc_type_0_item = cc_type_0_item_data.to_dict()
                cc.append(cc_type_0_item)


        else:
            cc = self.cc

        bcc: list[dict[str, Any]] | None | Unset
        if isinstance(self.bcc, Unset):
            bcc = UNSET
        elif isinstance(self.bcc, list):
            bcc = []
            for bcc_type_0_item_data in self.bcc:
                bcc_type_0_item = bcc_type_0_item_data.to_dict()
                bcc.append(bcc_type_0_item)


        else:
            bcc = self.bcc

        to_addresses: list[dict[str, Any]] | None | Unset
        if isinstance(self.to_addresses, Unset):
            to_addresses = UNSET
        elif isinstance(self.to_addresses, list):
            to_addresses = []
            for to_addresses_type_0_item_data in self.to_addresses:
                to_addresses_type_0_item = to_addresses_type_0_item_data.to_dict()
                to_addresses.append(to_addresses_type_0_item)


        else:
            to_addresses = self.to_addresses

        in_reply_to: list[str] | None | Unset
        if isinstance(self.in_reply_to, Unset):
            in_reply_to = UNSET
        elif isinstance(self.in_reply_to, list):
            in_reply_to = self.in_reply_to


        else:
            in_reply_to = self.in_reply_to

        references: list[str] | None | Unset
        if isinstance(self.references, Unset):
            references = UNSET
        elif isinstance(self.references, list):
            references = self.references


        else:
            references = self.references

        attachments: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.attachments, Unset):
            attachments = []
            for attachments_item_data in self.attachments:
                attachments_item = attachments_item_data.to_dict()
                attachments.append(attachments_item)



        error: dict[str, Any] | None | Unset
        if isinstance(self.error, Unset):
            error = UNSET
        elif isinstance(self.error, ParsedEmailDataErrorType0):
            error = self.error.to_dict()
        else:
            error = self.error


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "status": status,
        })
        if body_text is not UNSET:
            field_dict["body_text"] = body_text
        if body_html is not UNSET:
            field_dict["body_html"] = body_html
        if reply_to is not UNSET:
            field_dict["reply_to"] = reply_to
        if cc is not UNSET:
            field_dict["cc"] = cc
        if bcc is not UNSET:
            field_dict["bcc"] = bcc
        if to_addresses is not UNSET:
            field_dict["to_addresses"] = to_addresses
        if in_reply_to is not UNSET:
            field_dict["in_reply_to"] = in_reply_to
        if references is not UNSET:
            field_dict["references"] = references
        if attachments is not UNSET:
            field_dict["attachments"] = attachments
        if error is not UNSET:
            field_dict["error"] = error

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_address import EmailAddress
        from ..models.email_attachment import EmailAttachment
        from ..models.parsed_email_data_error_type_0 import ParsedEmailDataErrorType0
        d = dict(src_dict)
        status = ParsedEmailDataStatus(d.pop("status"))




        def _parse_body_text(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        body_text = _parse_body_text(d.pop("body_text", UNSET))


        def _parse_body_html(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        body_html = _parse_body_html(d.pop("body_html", UNSET))


        def _parse_reply_to(data: object) -> list[EmailAddress] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                reply_to_type_0 = []
                _reply_to_type_0 = data
                for reply_to_type_0_item_data in (_reply_to_type_0):
                    reply_to_type_0_item = EmailAddress.from_dict(reply_to_type_0_item_data)



                    reply_to_type_0.append(reply_to_type_0_item)

                return reply_to_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[EmailAddress] | None | Unset, data)

        reply_to = _parse_reply_to(d.pop("reply_to", UNSET))


        def _parse_cc(data: object) -> list[EmailAddress] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                cc_type_0 = []
                _cc_type_0 = data
                for cc_type_0_item_data in (_cc_type_0):
                    cc_type_0_item = EmailAddress.from_dict(cc_type_0_item_data)



                    cc_type_0.append(cc_type_0_item)

                return cc_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[EmailAddress] | None | Unset, data)

        cc = _parse_cc(d.pop("cc", UNSET))


        def _parse_bcc(data: object) -> list[EmailAddress] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                bcc_type_0 = []
                _bcc_type_0 = data
                for bcc_type_0_item_data in (_bcc_type_0):
                    bcc_type_0_item = EmailAddress.from_dict(bcc_type_0_item_data)



                    bcc_type_0.append(bcc_type_0_item)

                return bcc_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[EmailAddress] | None | Unset, data)

        bcc = _parse_bcc(d.pop("bcc", UNSET))


        def _parse_to_addresses(data: object) -> list[EmailAddress] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                to_addresses_type_0 = []
                _to_addresses_type_0 = data
                for to_addresses_type_0_item_data in (_to_addresses_type_0):
                    to_addresses_type_0_item = EmailAddress.from_dict(to_addresses_type_0_item_data)



                    to_addresses_type_0.append(to_addresses_type_0_item)

                return to_addresses_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[EmailAddress] | None | Unset, data)

        to_addresses = _parse_to_addresses(d.pop("to_addresses", UNSET))


        def _parse_in_reply_to(data: object) -> list[str] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                in_reply_to_type_0 = cast(list[str], data)

                return in_reply_to_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None | Unset, data)

        in_reply_to = _parse_in_reply_to(d.pop("in_reply_to", UNSET))


        def _parse_references(data: object) -> list[str] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                references_type_0 = cast(list[str], data)

                return references_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None | Unset, data)

        references = _parse_references(d.pop("references", UNSET))


        _attachments = d.pop("attachments", UNSET)
        attachments: list[EmailAttachment] | Unset = UNSET
        if _attachments is not UNSET:
            attachments = []
            for attachments_item_data in _attachments:
                attachments_item = EmailAttachment.from_dict(attachments_item_data)



                attachments.append(attachments_item)


        def _parse_error(data: object) -> None | ParsedEmailDataErrorType0 | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                error_type_0 = ParsedEmailDataErrorType0.from_dict(data)



                return error_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | ParsedEmailDataErrorType0 | Unset, data)

        error = _parse_error(d.pop("error", UNSET))


        parsed_email_data = cls(
            status=status,
            body_text=body_text,
            body_html=body_html,
            reply_to=reply_to,
            cc=cc,
            bcc=bcc,
            to_addresses=to_addresses,
            in_reply_to=in_reply_to,
            references=references,
            attachments=attachments,
            error=error,
        )


        parsed_email_data.additional_properties = d
        return parsed_email_data

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
