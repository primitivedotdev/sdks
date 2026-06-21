from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.agent_account_upgrade_hint_plan import AgentAccountUpgradeHintPlan






T = TypeVar("T", bound="AgentAccountUpgradeHint")



@_attrs_define
class AgentAccountUpgradeHint:
    """ In-band pointer to the upgrade path for an agent account.

        Attributes:
            plan (AgentAccountUpgradeHintPlan):
            description (str):
            claim_path (str):
     """

    plan: AgentAccountUpgradeHintPlan
    description: str
    claim_path: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        plan = self.plan.value

        description = self.description

        claim_path = self.claim_path


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "plan": plan,
            "description": description,
            "claim_path": claim_path,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        plan = AgentAccountUpgradeHintPlan(d.pop("plan"))




        description = d.pop("description")

        claim_path = d.pop("claim_path")

        agent_account_upgrade_hint = cls(
            plan=plan,
            description=description,
            claim_path=claim_path,
        )


        agent_account_upgrade_hint.additional_properties = d
        return agent_account_upgrade_hint

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
