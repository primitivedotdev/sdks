from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="CancelSentEmailByIdempotencyKeyBody")



@_attrs_define
class CancelSentEmailByIdempotencyKeyBody:
    """ 
        Attributes:
            idempotency_key (str): The `Idempotency-Key` the send was created with.
            created_before (datetime.datetime | Unset): Only consider sends created at or before this instant, such as when
                you first asked to cancel.
     """

    idempotency_key: str
    created_before: datetime.datetime | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        idempotency_key = self.idempotency_key

        created_before: str | Unset = UNSET
        if not isinstance(self.created_before, Unset):
            created_before = self.created_before.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "idempotency_key": idempotency_key,
        })
        if created_before is not UNSET:
            field_dict["created_before"] = created_before

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        idempotency_key = d.pop("idempotency_key")

        _created_before = d.pop("created_before", UNSET)
        created_before: datetime.datetime | Unset
        if isinstance(_created_before,  Unset):
            created_before = UNSET
        else:
            created_before = datetime.datetime.fromisoformat(_created_before)




        cancel_sent_email_by_idempotency_key_body = cls(
            idempotency_key=idempotency_key,
            created_before=created_before,
        )

        return cancel_sent_email_by_idempotency_key_body

