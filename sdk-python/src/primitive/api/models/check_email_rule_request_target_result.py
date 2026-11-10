from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.check_email_rule_request_target_result_target import CheckEmailRuleRequestTargetResultTarget





T = TypeVar("T", bound="CheckEmailRuleRequestTargetResult")



@_attrs_define
class CheckEmailRuleRequestTargetResult:
    """ 
        Attributes:
            target (CheckEmailRuleRequestTargetResultTarget):
            can_accept (bool): Whether they can accept a rule request now under their role.
            missing_permission (None | str): The permission their role lacks for accepting, when can_accept is false.
            warning (None | str): The same in words, with who can fix it.
     """

    target: CheckEmailRuleRequestTargetResultTarget
    can_accept: bool
    missing_permission: None | str
    warning: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.check_email_rule_request_target_result_target import CheckEmailRuleRequestTargetResultTarget # noqa: PLC0415
        target = self.target.to_dict()

        can_accept = self.can_accept

        missing_permission: None | str
        missing_permission = self.missing_permission

        warning: None | str
        warning = self.warning


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "target": target,
            "can_accept": can_accept,
            "missing_permission": missing_permission,
            "warning": warning,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.check_email_rule_request_target_result_target import CheckEmailRuleRequestTargetResultTarget # noqa: PLC0415
        d = dict(src_dict)
        target = CheckEmailRuleRequestTargetResultTarget.from_dict(d.pop("target"))




        can_accept = d.pop("can_accept")

        def _parse_missing_permission(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        missing_permission = _parse_missing_permission(d.pop("missing_permission"))


        def _parse_warning(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        warning = _parse_warning(d.pop("warning"))


        check_email_rule_request_target_result = cls(
            target=target,
            can_accept=can_accept,
            missing_permission=missing_permission,
            warning=warning,
        )


        check_email_rule_request_target_result.additional_properties = d
        return check_email_rule_request_target_result

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
