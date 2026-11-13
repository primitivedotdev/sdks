from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_readable_body_source import EmailReadableBodySource
from ..models.email_readable_parse_status_type_1 import EmailReadableParseStatusType1
from ..models.email_readable_parse_status_type_2_type_1 import EmailReadableParseStatusType2Type1
from ..models.email_readable_parse_status_type_3_type_1 import EmailReadableParseStatusType3Type1
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.email_readable_attachment import EmailReadableAttachment
  from ..models.email_readable_imported_type_0 import EmailReadableImportedType0
  from ..models.email_readable_link import EmailReadableLink





T = TypeVar("T", bound="EmailReadable")



@_attrs_define
class EmailReadable:
    """ What an inbound email says, as plain text, with the fields that identify it.

        Attributes:
            imported (EmailReadableImportedType0 | None): Historical acquisition; never sender or SMTP delivery proof. Null
                for live mail. Excluded from live tails and deltas.
            id (UUID): The inbound email id.
            thread_id (None | UUID): Its conversation, once it has been placed in one.
            received_at (datetime.datetime): When it was received.
            from_ (str): The From header with its display name, or the bare sender address when there is none.
            to (str): The address it was delivered to.
            subject (None | str): The subject line.
            parse_status (EmailReadableParseStatusType1 | EmailReadableParseStatusType2Type1 |
                EmailReadableParseStatusType3Type1 | None): How far parsing has got, as on `GET /emails/{id}`. While it is
                `pending` or `processing`, the body, `thread_id` and attachments may be missing or change, so read again
                shortly. `complete` is final. `failed` is final too: parsing ended without them, so they may be empty. Null on
                an email older than this field, and before parsing is recorded.
            preheader (None | str): The preview line a mail client shows beside the subject, hidden at the top of the body.
                Not repeated in `body_text`.
            body_text (None | str): One page of the readable body: the words of the email in reading order. Each link is a
                `[n]` marker beside its label, without its target (see `links`). Hidden content and the quoted history below a
                reply are left out. Empty when there is nothing to read or the body is not shown (a blocked sender, or a parse
                that failed after the body was accepted). May be null: this field carries message content, which is withheld
                when the content is not available to your credential.
            body_source (EmailReadableBodySource): The stored body the text came from, or `none` when there was nothing to
                read.
            body_chars (int): Length in characters of the whole readable body, across every page.
            body_offset (int): Where this page starts in the readable body: the `offset` sent, or 0.
            body_next_offset (int | None): The `offset` of the next page. Null at the end of the body.
            body_incomplete (bool): True when the HTML body was nested too deeply to read to the end and there was no text
                body to use: the readable body stops early. Use the detail read for the rest.
            quoted_chars_removed (int): Characters of quoted history (earlier messages a reply repeats) removed.
            image_count (int): Images in the body. Many images with little text means the email says most of it in pictures.
            link_count (int): Different links the whole readable body refers to, across every page.
            attachments (list[EmailReadableAttachment]): The attached files. Empty when there are none or the content is
                withheld.
            links (list[EmailReadableLink] | Unset): Link targets. Present only when the request carried `links`.
     """

    imported: EmailReadableImportedType0 | None
    id: UUID
    thread_id: None | UUID
    received_at: datetime.datetime
    from_: str
    to: str
    subject: None | str
    parse_status: EmailReadableParseStatusType1 | EmailReadableParseStatusType2Type1 | EmailReadableParseStatusType3Type1 | None
    preheader: None | str
    body_text: None | str
    body_source: EmailReadableBodySource
    body_chars: int
    body_offset: int
    body_next_offset: int | None
    body_incomplete: bool
    quoted_chars_removed: int
    image_count: int
    link_count: int
    attachments: list[EmailReadableAttachment]
    links: list[EmailReadableLink] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_readable_attachment import EmailReadableAttachment # noqa: PLC0415
        from ..models.email_readable_imported_type_0 import EmailReadableImportedType0 # noqa: PLC0415
        from ..models.email_readable_link import EmailReadableLink # noqa: PLC0415
        imported: dict[str, Any] | None
        if isinstance(self.imported, EmailReadableImportedType0):
            imported = self.imported.to_dict()
        else:
            imported = self.imported

        id = str(self.id)

        thread_id: None | str
        if isinstance(self.thread_id, UUID):
            thread_id = str(self.thread_id)
        else:
            thread_id = self.thread_id

        received_at = self.received_at.isoformat()

        from_ = self.from_

        to = self.to

        subject: None | str
        subject = self.subject

        parse_status: None | str
        if isinstance(self.parse_status, EmailReadableParseStatusType1):
            parse_status = self.parse_status.value
        elif isinstance(self.parse_status, EmailReadableParseStatusType2Type1):
            parse_status = self.parse_status.value
        elif isinstance(self.parse_status, EmailReadableParseStatusType3Type1):
            parse_status = self.parse_status.value
        else:
            parse_status = self.parse_status

        preheader: None | str
        preheader = self.preheader

        body_text: None | str
        body_text = self.body_text

        body_source = self.body_source.value

        body_chars = self.body_chars

        body_offset = self.body_offset

        body_next_offset: int | None
        body_next_offset = self.body_next_offset

        body_incomplete = self.body_incomplete

        quoted_chars_removed = self.quoted_chars_removed

        image_count = self.image_count

        link_count = self.link_count

        attachments = []
        for attachments_item_data in self.attachments:
            attachments_item = attachments_item_data.to_dict()
            attachments.append(attachments_item)



        links: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.links, Unset):
            links = []
            for links_item_data in self.links:
                links_item = links_item_data.to_dict()
                links.append(links_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "imported": imported,
            "id": id,
            "thread_id": thread_id,
            "received_at": received_at,
            "from": from_,
            "to": to,
            "subject": subject,
            "parse_status": parse_status,
            "preheader": preheader,
            "body_text": body_text,
            "body_source": body_source,
            "body_chars": body_chars,
            "body_offset": body_offset,
            "body_next_offset": body_next_offset,
            "body_incomplete": body_incomplete,
            "quoted_chars_removed": quoted_chars_removed,
            "image_count": image_count,
            "link_count": link_count,
            "attachments": attachments,
        })
        if links is not UNSET:
            field_dict["links"] = links

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_readable_attachment import EmailReadableAttachment # noqa: PLC0415
        from ..models.email_readable_imported_type_0 import EmailReadableImportedType0 # noqa: PLC0415
        from ..models.email_readable_link import EmailReadableLink # noqa: PLC0415
        d = dict(src_dict)
        def _parse_imported(data: object) -> EmailReadableImportedType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                imported_type_0 = EmailReadableImportedType0.from_dict(data)



                return imported_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailReadableImportedType0 | None, data)

        imported = _parse_imported(d.pop("imported"))


        id = UUID(d.pop("id"))




        def _parse_thread_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                thread_id_type_0 = UUID(data)



                return thread_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        thread_id = _parse_thread_id(d.pop("thread_id"))


        received_at = datetime.datetime.fromisoformat(d.pop("received_at"))




        from_ = d.pop("from")

        to = d.pop("to")

        def _parse_subject(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        subject = _parse_subject(d.pop("subject"))


        def _parse_parse_status(data: object) -> EmailReadableParseStatusType1 | EmailReadableParseStatusType2Type1 | EmailReadableParseStatusType3Type1 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                parse_status_type_1 = EmailReadableParseStatusType1(data)



                return parse_status_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                parse_status_type_2_type_1 = EmailReadableParseStatusType2Type1(data)



                return parse_status_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                parse_status_type_3_type_1 = EmailReadableParseStatusType3Type1(data)



                return parse_status_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailReadableParseStatusType1 | EmailReadableParseStatusType2Type1 | EmailReadableParseStatusType3Type1 | None, data)

        parse_status = _parse_parse_status(d.pop("parse_status"))


        def _parse_preheader(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        preheader = _parse_preheader(d.pop("preheader"))


        def _parse_body_text(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        body_text = _parse_body_text(d.pop("body_text"))


        body_source = EmailReadableBodySource(d.pop("body_source"))




        body_chars = d.pop("body_chars")

        body_offset = d.pop("body_offset")

        def _parse_body_next_offset(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        body_next_offset = _parse_body_next_offset(d.pop("body_next_offset"))


        body_incomplete = d.pop("body_incomplete")

        quoted_chars_removed = d.pop("quoted_chars_removed")

        image_count = d.pop("image_count")

        link_count = d.pop("link_count")

        attachments = []
        _attachments = d.pop("attachments")
        for attachments_item_data in (_attachments):
            attachments_item = EmailReadableAttachment.from_dict(attachments_item_data)



            attachments.append(attachments_item)


        _links = d.pop("links", UNSET)
        links: list[EmailReadableLink] | Unset = UNSET
        if _links is not UNSET:
            links = []
            for links_item_data in _links:
                links_item = EmailReadableLink.from_dict(links_item_data)



                links.append(links_item)


        email_readable = cls(
            imported=imported,
            id=id,
            thread_id=thread_id,
            received_at=received_at,
            from_=from_,
            to=to,
            subject=subject,
            parse_status=parse_status,
            preheader=preheader,
            body_text=body_text,
            body_source=body_source,
            body_chars=body_chars,
            body_offset=body_offset,
            body_next_offset=body_next_offset,
            body_incomplete=body_incomplete,
            quoted_chars_removed=quoted_chars_removed,
            image_count=image_count,
            link_count=link_count,
            attachments=attachments,
            links=links,
        )


        email_readable.additional_properties = d
        return email_readable

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
