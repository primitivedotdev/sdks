from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.accept_email_rule_request_result_request import AcceptEmailRuleRequestResultRequest
  from ..models.accept_email_rule_request_result_rule import AcceptEmailRuleRequestResultRule
  from ..models.accept_email_rule_request_result_share import AcceptEmailRuleRequestResultShare





T = TypeVar("T", bound="AcceptEmailRuleRequestResult")



@_attrs_define
class AcceptEmailRuleRequestResult:
    """ 
        Attributes:
            request (AcceptEmailRuleRequestResultRequest):
            rule (AcceptEmailRuleRequestResultRule):
            share (AcceptEmailRuleRequestResultShare):
     """

    request: AcceptEmailRuleRequestResultRequest
    rule: AcceptEmailRuleRequestResultRule
    share: AcceptEmailRuleRequestResultShare
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.accept_email_rule_request_result_request import AcceptEmailRuleRequestResultRequest # noqa: PLC0415
        from ..models.accept_email_rule_request_result_rule import AcceptEmailRuleRequestResultRule # noqa: PLC0415
        from ..models.accept_email_rule_request_result_share import AcceptEmailRuleRequestResultShare # noqa: PLC0415
        request = self.request.to_dict()

        rule = self.rule.to_dict()

        share = self.share.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "request": request,
            "rule": rule,
            "share": share,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.accept_email_rule_request_result_request import AcceptEmailRuleRequestResultRequest # noqa: PLC0415
        from ..models.accept_email_rule_request_result_rule import AcceptEmailRuleRequestResultRule # noqa: PLC0415
        from ..models.accept_email_rule_request_result_share import AcceptEmailRuleRequestResultShare # noqa: PLC0415
        d = dict(src_dict)
        request = AcceptEmailRuleRequestResultRequest.from_dict(d.pop("request"))




        rule = AcceptEmailRuleRequestResultRule.from_dict(d.pop("rule"))




        share = AcceptEmailRuleRequestResultShare.from_dict(d.pop("share"))




        accept_email_rule_request_result = cls(
            request=request,
            rule=rule,
            share=share,
        )


        accept_email_rule_request_result.additional_properties = d
        return accept_email_rule_request_result

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
