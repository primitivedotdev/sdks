from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.sent_email_status import SentEmailStatus
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="EmailDetailReply")



@_attrs_define
class EmailDetailReply:
    """ 
        Attributes:
            id (UUID): Sent-email row id.
            status (SentEmailStatus):
            to_address (str): Recipient address as recorded on the sent_emails row.
            created_at (datetime.datetime):
            subject (None | str | Unset):
            queue_id (None | str | Unset): Outbound relay queue identifier when available.
     """

    id: UUID
    status: SentEmailStatus
    to_address: str
    created_at: datetime.datetime
    subject: None | str | Unset = UNSET
    queue_id: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        status = self.status.value

        to_address = self.to_address

        created_at = self.created_at.isoformat()

        subject: None | str | Unset
        if isinstance(self.subject, Unset):
            subject = UNSET
        else:
            subject = self.subject

        queue_id: None | str | Unset
        if isinstance(self.queue_id, Unset):
            queue_id = UNSET
        else:
            queue_id = self.queue_id


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "status": status,
            "to_address": to_address,
            "created_at": created_at,
        })
        if subject is not UNSET:
            field_dict["subject"] = subject
        if queue_id is not UNSET:
            field_dict["queue_id"] = queue_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        status = SentEmailStatus(d.pop("status"))




        to_address = d.pop("to_address")

        created_at = isoparse(d.pop("created_at"))




        def _parse_subject(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        subject = _parse_subject(d.pop("subject", UNSET))


        def _parse_queue_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        queue_id = _parse_queue_id(d.pop("queue_id", UNSET))


        email_detail_reply = cls(
            id=id,
            status=status,
            to_address=to_address,
            created_at=created_at,
            subject=subject,
            queue_id=queue_id,
        )


        email_detail_reply.additional_properties = d
        return email_detail_reply

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
