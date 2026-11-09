from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_detail_collaboration_peer_signal_on_my_last_type_0_kind import EmailDetailCollaborationPeerSignalOnMyLastType0Kind
from typing import cast
import datetime






T = TypeVar("T", bound="EmailDetailCollaborationPeerSignalOnMyLastType0")



@_attrs_define
class EmailDetailCollaborationPeerSignalOnMyLastType0:
    """ The latest explicit signal (`read`, `ack` or `working`) that an authenticated recipient of your last message in this
    thread (not counting your status signals) sent about that message, or null. An expired `working` signal is not
    reported. Delivery alone never produces one.

        Attributes:
            kind (EmailDetailCollaborationPeerSignalOnMyLastType0Kind):
            at (datetime.datetime): When the signal arrived.
     """

    kind: EmailDetailCollaborationPeerSignalOnMyLastType0Kind
    at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        at = self.at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
            "at": at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = EmailDetailCollaborationPeerSignalOnMyLastType0Kind(d.pop("kind"))




        at = datetime.datetime.fromisoformat(d.pop("at"))




        email_detail_collaboration_peer_signal_on_my_last_type_0 = cls(
            kind=kind,
            at=at,
        )


        email_detail_collaboration_peer_signal_on_my_last_type_0.additional_properties = d
        return email_detail_collaboration_peer_signal_on_my_last_type_0

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
