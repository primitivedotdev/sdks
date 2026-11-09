from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.check_default_network_contact_admission_response_200_data_sender_relation import CheckDefaultNetworkContactAdmissionResponse200DataSenderRelation
from typing import cast
import datetime






T = TypeVar("T", bound="CheckDefaultNetworkContactAdmissionResponse200Data")



@_attrs_define
class CheckDefaultNetworkContactAdmissionResponse200Data:
    """
        Attributes:
            member_policy_required (bool):
            allowed (bool):
            allowed_since (datetime.datetime | None):
            pending (bool):
            sender_relation (CheckDefaultNetworkContactAdmissionResponse200DataSenderRelation | Unset):
     """

    member_policy_required: bool
    allowed: bool
    allowed_since: datetime.datetime | None
    pending: bool
    sender_relation: CheckDefaultNetworkContactAdmissionResponse200DataSenderRelation | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        member_policy_required = self.member_policy_required

        allowed = self.allowed

        allowed_since: None | str
        if isinstance(self.allowed_since, datetime.datetime):
            allowed_since = self.allowed_since.isoformat()
        else:
            allowed_since = self.allowed_since

        pending = self.pending

        sender_relation: str | Unset = UNSET
        if not isinstance(self.sender_relation, Unset):
            sender_relation = self.sender_relation.value



        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "member_policy_required": member_policy_required,
            "allowed": allowed,
            "allowed_since": allowed_since,
            "pending": pending,
        })
        if sender_relation is not UNSET:
            field_dict["sender_relation"] = sender_relation

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        member_policy_required = d.pop("member_policy_required")

        allowed = d.pop("allowed")

        def _parse_allowed_since(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                allowed_since_type_0 = datetime.datetime.fromisoformat(data)



                return allowed_since_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        allowed_since = _parse_allowed_since(d.pop("allowed_since"))


        pending = d.pop("pending")

        _sender_relation = d.pop("sender_relation", UNSET)
        sender_relation: CheckDefaultNetworkContactAdmissionResponse200DataSenderRelation | Unset
        if isinstance(_sender_relation,  Unset):
            sender_relation = UNSET
        else:
            sender_relation = CheckDefaultNetworkContactAdmissionResponse200DataSenderRelation(_sender_relation)




        check_default_network_contact_admission_response_200_data = cls(
            member_policy_required=member_policy_required,
            allowed=allowed,
            allowed_since=allowed_since,
            pending=pending,
            sender_relation=sender_relation,
        )


        check_default_network_contact_admission_response_200_data.additional_properties = d
        return check_default_network_contact_admission_response_200_data

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
