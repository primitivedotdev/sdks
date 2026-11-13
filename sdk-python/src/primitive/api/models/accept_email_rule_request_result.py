from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_request import EmailRuleRequest
  from ..models.email_rule_share import EmailRuleShare
  from ..models.email_rule_with_version import EmailRuleWithVersion





T = TypeVar("T", bound="AcceptEmailRuleRequestResult")



@_attrs_define
class AcceptEmailRuleRequestResult:
    """ 
        Attributes:
            request (EmailRuleRequest):
            rule (EmailRuleWithVersion):
            share (EmailRuleShare):
            notice (str | Unset): What is now shared, in words. When you changed the rule and it can now match mail the
                request left out by who it was sent to (such as mail where an address is only copied), that comes first; when
                you changed its english, tree or explanation (edited_on_accept; a new name alone is no change), that
                rule.current is what you agreed to and request what was asked.
     """

    request: EmailRuleRequest
    rule: EmailRuleWithVersion
    share: EmailRuleShare
    notice: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_request import EmailRuleRequest # noqa: PLC0415
        from ..models.email_rule_share import EmailRuleShare # noqa: PLC0415
        from ..models.email_rule_with_version import EmailRuleWithVersion # noqa: PLC0415
        request = self.request.to_dict()

        rule = self.rule.to_dict()

        share = self.share.to_dict()

        notice = self.notice


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "request": request,
            "rule": rule,
            "share": share,
        })
        if notice is not UNSET:
            field_dict["notice"] = notice

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_request import EmailRuleRequest # noqa: PLC0415
        from ..models.email_rule_share import EmailRuleShare # noqa: PLC0415
        from ..models.email_rule_with_version import EmailRuleWithVersion # noqa: PLC0415
        d = dict(src_dict)
        request = EmailRuleRequest.from_dict(d.pop("request"))




        rule = EmailRuleWithVersion.from_dict(d.pop("rule"))




        share = EmailRuleShare.from_dict(d.pop("share"))




        notice = d.pop("notice", UNSET)

        accept_email_rule_request_result = cls(
            request=request,
            rule=rule,
            share=share,
            notice=notice,
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
