from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.credit_balance_budget_type_0 import CreditBalanceBudgetType0
  from ..models.credit_balance_prepaid_credit_type_0 import CreditBalancePrepaidCreditType0





T = TypeVar("T", bound="CreditBalance")



@_attrs_define
class CreditBalance:
    """ 
        Attributes:
            budget (CreditBalanceBudgetType0 | None): The active agent spending budget an operator funded for top-ups,
                or null when there is none.
            prepaid_credit (CreditBalancePrepaidCreditType0 | None | Unset): Prepaid usage credit (top-ups, redeemed credit
                codes and granted
                credit) that can still pay for usage, or null when there is none.
                Omitted when an exact figure cannot be given right now; the budget
                is still returned.
     """

    budget: CreditBalanceBudgetType0 | None
    prepaid_credit: CreditBalancePrepaidCreditType0 | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.credit_balance_budget_type_0 import CreditBalanceBudgetType0
        from ..models.credit_balance_prepaid_credit_type_0 import CreditBalancePrepaidCreditType0
        budget: dict[str, Any] | None
        if isinstance(self.budget, CreditBalanceBudgetType0):
            budget = self.budget.to_dict()
        else:
            budget = self.budget

        prepaid_credit: dict[str, Any] | None | Unset
        if isinstance(self.prepaid_credit, Unset):
            prepaid_credit = UNSET
        elif isinstance(self.prepaid_credit, CreditBalancePrepaidCreditType0):
            prepaid_credit = self.prepaid_credit.to_dict()
        else:
            prepaid_credit = self.prepaid_credit


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "budget": budget,
        })
        if prepaid_credit is not UNSET:
            field_dict["prepaid_credit"] = prepaid_credit

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.credit_balance_budget_type_0 import CreditBalanceBudgetType0
        from ..models.credit_balance_prepaid_credit_type_0 import CreditBalancePrepaidCreditType0
        d = dict(src_dict)
        def _parse_budget(data: object) -> CreditBalanceBudgetType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                budget_type_0 = CreditBalanceBudgetType0.from_dict(data)



                return budget_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(CreditBalanceBudgetType0 | None, data)

        budget = _parse_budget(d.pop("budget"))


        def _parse_prepaid_credit(data: object) -> CreditBalancePrepaidCreditType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                prepaid_credit_type_0 = CreditBalancePrepaidCreditType0.from_dict(data)



                return prepaid_credit_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(CreditBalancePrepaidCreditType0 | None | Unset, data)

        prepaid_credit = _parse_prepaid_credit(d.pop("prepaid_credit", UNSET))


        credit_balance = cls(
            budget=budget,
            prepaid_credit=prepaid_credit,
        )


        credit_balance.additional_properties = d
        return credit_balance

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
