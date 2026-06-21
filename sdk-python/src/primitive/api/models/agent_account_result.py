from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.agent_account_result_plan import AgentAccountResultPlan
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.agent_account_upgrade_hint import AgentAccountUpgradeHint
  from ..models.plan_limits import PlanLimits





T = TypeVar("T", bound="AgentAccountResult")



@_attrs_define
class AgentAccountResult:
    """ 
        Attributes:
            api_key (str): One-time API key (prefixed `prim_`). Shown once; store it securely.
            org_id (UUID):
            address (None | str): Provisioned managed inbox FQDN, or null if the inbox publish was deferred.
            plan (AgentAccountResultPlan):
            limits (PlanLimits): Plan-derived quota limits for an account.
            upgrade (AgentAccountUpgradeHint): In-band pointer to the upgrade path for an agent account.
     """

    api_key: str
    org_id: UUID
    address: None | str
    plan: AgentAccountResultPlan
    limits: PlanLimits
    upgrade: AgentAccountUpgradeHint
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.agent_account_upgrade_hint import AgentAccountUpgradeHint
        from ..models.plan_limits import PlanLimits
        api_key = self.api_key

        org_id = str(self.org_id)

        address: None | str
        address = self.address

        plan = self.plan.value

        limits = self.limits.to_dict()

        upgrade = self.upgrade.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "api_key": api_key,
            "org_id": org_id,
            "address": address,
            "plan": plan,
            "limits": limits,
            "upgrade": upgrade,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.agent_account_upgrade_hint import AgentAccountUpgradeHint
        from ..models.plan_limits import PlanLimits
        d = dict(src_dict)
        api_key = d.pop("api_key")

        org_id = UUID(d.pop("org_id"))




        def _parse_address(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        address = _parse_address(d.pop("address"))


        plan = AgentAccountResultPlan(d.pop("plan"))




        limits = PlanLimits.from_dict(d.pop("limits"))




        upgrade = AgentAccountUpgradeHint.from_dict(d.pop("upgrade"))




        agent_account_result = cls(
            api_key=api_key,
            org_id=org_id,
            address=address,
            plan=plan,
            limits=limits,
            upgrade=upgrade,
        )


        agent_account_result.additional_properties = d
        return agent_account_result

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
