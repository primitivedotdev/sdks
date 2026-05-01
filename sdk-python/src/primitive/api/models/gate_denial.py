from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.gate_denial_name import GateDenialName
from ..models.gate_denial_reason import GateDenialReason
from typing import cast

if TYPE_CHECKING:
  from ..models.gate_fix import GateFix





T = TypeVar("T", bound="GateDenial")



@_attrs_define
class GateDenial:
    """ 
        Attributes:
            name (GateDenialName): Public recipient-scope gate name that denied the send.
            reason (GateDenialReason): Stable machine-readable denial reason.
            message (str): Human-readable explanation of the gate denial.
            subject (str): Domain or address the gate evaluated.
            fix (GateFix | Unset):
            docs_url (str | Unset): Public docs URL with more context.
     """

    name: GateDenialName
    reason: GateDenialReason
    message: str
    subject: str
    fix: GateFix | Unset = UNSET
    docs_url: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.gate_fix import GateFix
        name = self.name.value

        reason = self.reason.value

        message = self.message

        subject = self.subject

        fix: dict[str, Any] | Unset = UNSET
        if not isinstance(self.fix, Unset):
            fix = self.fix.to_dict()

        docs_url = self.docs_url


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
            "reason": reason,
            "message": message,
            "subject": subject,
        })
        if fix is not UNSET:
            field_dict["fix"] = fix
        if docs_url is not UNSET:
            field_dict["docs_url"] = docs_url

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.gate_fix import GateFix
        d = dict(src_dict)
        name = GateDenialName(d.pop("name"))




        reason = GateDenialReason(d.pop("reason"))




        message = d.pop("message")

        subject = d.pop("subject")

        _fix = d.pop("fix", UNSET)
        fix: GateFix | Unset
        if isinstance(_fix,  Unset):
            fix = UNSET
        else:
            fix = GateFix.from_dict(_fix)




        docs_url = d.pop("docs_url", UNSET)

        gate_denial = cls(
            name=name,
            reason=reason,
            message=message,
            subject=subject,
            fix=fix,
            docs_url=docs_url,
        )


        gate_denial.additional_properties = d
        return gate_denial

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
