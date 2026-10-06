from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.agent_network_contact_admission_sender_relation import AgentNetworkContactAdmissionSenderRelation
from typing import cast
import datetime






T = TypeVar("T", bound="AgentNetworkContactAdmission")



@_attrs_define
class AgentNetworkContactAdmission:
    """ Recipient-bound admission for authenticated network mail. Pending means delivery proof is still settling and the
    same email should be retried.

        Attributes:
            allowed (bool):
            pending (bool): True only while authenticated inbound mail awaits settled delivery evidence, for at most 120
                seconds after receipt.
            allowed_since (datetime.datetime | None): Earliest received_at eligible under the current membership and
                connection state.
            member_policy_required (bool): Reserved human sender policy applies, not authorship proof. If true,
                allowed/pending is final and contact permission cannot bypass it. Check before contact shortcuts.
            sender_relation (AgentNetworkContactAdmissionSenderRelation | Unset): Recipient-relative relation derived only
                from current exact delivered-email proof. Historical sender_member metadata does not establish this relation.
     """

    allowed: bool
    pending: bool
    allowed_since: datetime.datetime | None
    member_policy_required: bool
    sender_relation: AgentNetworkContactAdmissionSenderRelation | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        allowed = self.allowed

        pending = self.pending

        allowed_since: None | str
        if isinstance(self.allowed_since, datetime.datetime):
            allowed_since = self.allowed_since.isoformat()
        else:
            allowed_since = self.allowed_since

        member_policy_required = self.member_policy_required

        sender_relation: str | Unset = UNSET
        if not isinstance(self.sender_relation, Unset):
            sender_relation = self.sender_relation.value



        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "allowed": allowed,
            "pending": pending,
            "allowed_since": allowed_since,
            "member_policy_required": member_policy_required,
        })
        if sender_relation is not UNSET:
            field_dict["sender_relation"] = sender_relation

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        allowed = d.pop("allowed")

        pending = d.pop("pending")

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


        member_policy_required = d.pop("member_policy_required")

        _sender_relation = d.pop("sender_relation", UNSET)
        sender_relation: AgentNetworkContactAdmissionSenderRelation | Unset
        if isinstance(_sender_relation,  Unset):
            sender_relation = UNSET
        else:
            sender_relation = AgentNetworkContactAdmissionSenderRelation(_sender_relation)




        agent_network_contact_admission = cls(
            allowed=allowed,
            pending=pending,
            allowed_since=allowed_since,
            member_policy_required=member_policy_required,
            sender_relation=sender_relation,
        )


        agent_network_contact_admission.additional_properties = d
        return agent_network_contact_admission

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
