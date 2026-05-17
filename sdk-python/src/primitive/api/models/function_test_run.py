from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="FunctionTestRun")



@_attrs_define
class FunctionTestRun:
    """ 
        Attributes:
            id (UUID):
            function_id (UUID):
            inbound_domain (str):
            to (str):
            from_ (str):
            subject (str):
            poll_since (datetime.datetime):
            created_at (datetime.datetime):
            sent_at (datetime.datetime | None):
            send_error (None | str):
     """

    id: UUID
    function_id: UUID
    inbound_domain: str
    to: str
    from_: str
    subject: str
    poll_since: datetime.datetime
    created_at: datetime.datetime
    sent_at: datetime.datetime | None
    send_error: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        function_id = str(self.function_id)

        inbound_domain = self.inbound_domain

        to = self.to

        from_ = self.from_

        subject = self.subject

        poll_since = self.poll_since.isoformat()

        created_at = self.created_at.isoformat()

        sent_at: None | str
        if isinstance(self.sent_at, datetime.datetime):
            sent_at = self.sent_at.isoformat()
        else:
            sent_at = self.sent_at

        send_error: None | str
        send_error = self.send_error


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "function_id": function_id,
            "inbound_domain": inbound_domain,
            "to": to,
            "from": from_,
            "subject": subject,
            "poll_since": poll_since,
            "created_at": created_at,
            "sent_at": sent_at,
            "send_error": send_error,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        function_id = UUID(d.pop("function_id"))




        inbound_domain = d.pop("inbound_domain")

        to = d.pop("to")

        from_ = d.pop("from")

        subject = d.pop("subject")

        poll_since = isoparse(d.pop("poll_since"))




        created_at = isoparse(d.pop("created_at"))




        def _parse_sent_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                sent_at_type_0 = isoparse(data)



                return sent_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        sent_at = _parse_sent_at(d.pop("sent_at"))


        def _parse_send_error(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        send_error = _parse_send_error(d.pop("send_error"))


        function_test_run = cls(
            id=id,
            function_id=function_id,
            inbound_domain=inbound_domain,
            to=to,
            from_=from_,
            subject=subject,
            poll_since=poll_since,
            created_at=created_at,
            sent_at=sent_at,
            send_error=send_error,
        )


        function_test_run.additional_properties = d
        return function_test_run

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
