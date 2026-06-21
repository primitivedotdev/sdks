from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.agent_claim_result_plan import AgentClaimResultPlan
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.plan_limits import PlanLimits





T = TypeVar("T", bound="AgentClaimResult")



@_attrs_define
class AgentClaimResult:
    """ 
        Attributes:
            org_id (UUID):
            plan (AgentClaimResultPlan):
            email (str):
            limits (PlanLimits): Plan-derived quota limits for an account.
     """

    org_id: UUID
    plan: AgentClaimResultPlan
    email: str
    limits: PlanLimits
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.plan_limits import PlanLimits
        org_id = str(self.org_id)

        plan = self.plan.value

        email = self.email

        limits = self.limits.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "org_id": org_id,
            "plan": plan,
            "email": email,
            "limits": limits,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.plan_limits import PlanLimits
        d = dict(src_dict)
        org_id = UUID(d.pop("org_id"))




        plan = AgentClaimResultPlan(d.pop("plan"))




        email = d.pop("email")

        limits = PlanLimits.from_dict(d.pop("limits"))




        agent_claim_result = cls(
            org_id=org_id,
            plan=plan,
            email=email,
            limits=limits,
        )


        agent_claim_result.additional_properties = d
        return agent_claim_result

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
