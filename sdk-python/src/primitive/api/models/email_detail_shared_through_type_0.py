from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.email_detail_shared_through_type_0_sharer import EmailDetailSharedThroughType0Sharer





T = TypeVar("T", bound="EmailDetailSharedThroughType0")



@_attrs_define
class EmailDetailSharedThroughType0:
    """ Only for a reader who has this email through a colleague's share of their mail, when that share is their only way to
    it: the share and who gave it. Null for everyone else, including on your own mail when a rule or share of yours gave
    it to someone: rule_deliveries counts the webhooks rules delivered it to, and GET /v1/email-rule-shares/{id}/emails
    lists what a share you gave has given.

        Attributes:
            share_id (UUID): The share.
            rule_name (str): The name of the rule that was shared.
            sharer (EmailDetailSharedThroughType0Sharer): Who shared it.
     """

    share_id: UUID
    rule_name: str
    sharer: EmailDetailSharedThroughType0Sharer
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_detail_shared_through_type_0_sharer import EmailDetailSharedThroughType0Sharer # noqa: PLC0415
        share_id = str(self.share_id)

        rule_name = self.rule_name

        sharer = self.sharer.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "share_id": share_id,
            "rule_name": rule_name,
            "sharer": sharer,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_detail_shared_through_type_0_sharer import EmailDetailSharedThroughType0Sharer # noqa: PLC0415
        d = dict(src_dict)
        share_id = UUID(d.pop("share_id"))




        rule_name = d.pop("rule_name")

        sharer = EmailDetailSharedThroughType0Sharer.from_dict(d.pop("sharer"))




        email_detail_shared_through_type_0 = cls(
            share_id=share_id,
            rule_name=rule_name,
            sharer=sharer,
        )


        email_detail_shared_through_type_0.additional_properties = d
        return email_detail_shared_through_type_0

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
