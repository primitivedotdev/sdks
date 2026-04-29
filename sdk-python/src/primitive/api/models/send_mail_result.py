from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="SendMailResult")



@_attrs_define
class SendMailResult:
    """ 
        Attributes:
            accepted (list[str]): Recipient addresses accepted by the relay.
            rejected (list[str]): Recipient addresses rejected by the relay.
            queue_id (str | Unset): Message identifier assigned by Primitive's outbound relay, when available.
     """

    accepted: list[str]
    rejected: list[str]
    queue_id: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        accepted = self.accepted



        rejected = self.rejected



        queue_id = self.queue_id


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "accepted": accepted,
            "rejected": rejected,
        })
        if queue_id is not UNSET:
            field_dict["queue_id"] = queue_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        accepted = cast(list[str], d.pop("accepted"))


        rejected = cast(list[str], d.pop("rejected"))


        queue_id = d.pop("queue_id", UNSET)

        send_mail_result = cls(
            accepted=accepted,
            rejected=rejected,
            queue_id=queue_id,
        )


        send_mail_result.additional_properties = d
        return send_mail_result

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
