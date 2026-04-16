from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.delivery_summary_status import DeliverySummaryStatus
from ..types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.delivery_summary_email_type_0 import DeliverySummaryEmailType0





T = TypeVar("T", bound="DeliverySummary")



@_attrs_define
class DeliverySummary:
    """ 
        Attributes:
            id (str): Delivery ID (numeric string)
            email_id (UUID):
            org_id (UUID):
            endpoint_id (UUID):
            endpoint_url (str):
            status (DeliverySummaryStatus):
            attempt_count (int):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            duration_ms (int | None | Unset):
            last_error (None | str | Unset):
            email (DeliverySummaryEmailType0 | None | Unset):
     """

    id: str
    email_id: UUID
    org_id: UUID
    endpoint_id: UUID
    endpoint_url: str
    status: DeliverySummaryStatus
    attempt_count: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    duration_ms: int | None | Unset = UNSET
    last_error: None | str | Unset = UNSET
    email: DeliverySummaryEmailType0 | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.delivery_summary_email_type_0 import DeliverySummaryEmailType0
        id = self.id

        email_id = str(self.email_id)

        org_id = str(self.org_id)

        endpoint_id = str(self.endpoint_id)

        endpoint_url = self.endpoint_url

        status = self.status.value

        attempt_count = self.attempt_count

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        duration_ms: int | None | Unset
        if isinstance(self.duration_ms, Unset):
            duration_ms = UNSET
        else:
            duration_ms = self.duration_ms

        last_error: None | str | Unset
        if isinstance(self.last_error, Unset):
            last_error = UNSET
        else:
            last_error = self.last_error

        email: dict[str, Any] | None | Unset
        if isinstance(self.email, Unset):
            email = UNSET
        elif isinstance(self.email, DeliverySummaryEmailType0):
            email = self.email.to_dict()
        else:
            email = self.email


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "email_id": email_id,
            "org_id": org_id,
            "endpoint_id": endpoint_id,
            "endpoint_url": endpoint_url,
            "status": status,
            "attempt_count": attempt_count,
            "created_at": created_at,
            "updated_at": updated_at,
        })
        if duration_ms is not UNSET:
            field_dict["duration_ms"] = duration_ms
        if last_error is not UNSET:
            field_dict["last_error"] = last_error
        if email is not UNSET:
            field_dict["email"] = email

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.delivery_summary_email_type_0 import DeliverySummaryEmailType0
        d = dict(src_dict)
        id = d.pop("id")

        email_id = UUID(d.pop("email_id"))




        org_id = UUID(d.pop("org_id"))




        endpoint_id = UUID(d.pop("endpoint_id"))




        endpoint_url = d.pop("endpoint_url")

        status = DeliverySummaryStatus(d.pop("status"))




        attempt_count = d.pop("attempt_count")

        created_at = isoparse(d.pop("created_at"))




        updated_at = isoparse(d.pop("updated_at"))




        def _parse_duration_ms(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        duration_ms = _parse_duration_ms(d.pop("duration_ms", UNSET))


        def _parse_last_error(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        last_error = _parse_last_error(d.pop("last_error", UNSET))


        def _parse_email(data: object) -> DeliverySummaryEmailType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                email_type_0 = DeliverySummaryEmailType0.from_dict(data)



                return email_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(DeliverySummaryEmailType0 | None | Unset, data)

        email = _parse_email(d.pop("email", UNSET))


        delivery_summary = cls(
            id=id,
            email_id=email_id,
            org_id=org_id,
            endpoint_id=endpoint_id,
            endpoint_url=endpoint_url,
            status=status,
            attempt_count=attempt_count,
            created_at=created_at,
            updated_at=updated_at,
            duration_ms=duration_ms,
            last_error=last_error,
            email=email,
        )


        delivery_summary.additional_properties = d
        return delivery_summary

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
