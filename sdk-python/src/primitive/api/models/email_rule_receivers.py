from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_receivers_keys_item import EmailRuleReceiversKeysItem
  from ..models.email_rule_receivers_shares_item import EmailRuleReceiversSharesItem
  from ..models.email_rule_receivers_webhooks_item import EmailRuleReceiversWebhooksItem





T = TypeVar("T", bound="EmailRuleReceivers")



@_attrs_define
class EmailRuleReceivers:
    """ Who receives what the rule shares now, by person and count; empty unless it is an active grant rule.

        Attributes:
            keys (list[EmailRuleReceiversKeysItem]): API keys that work now (not revoked, expired or suspended) and hold
                mail:read, whose access lists the rule or its live share. Owner: who holds each, or the organization.
            webhooks (list[EmailRuleReceiversWebhooksItem]): Webhooks taking received mail, bounces or reports that are sent
                what it matches: those of the key delivery acts as, when it lists the rule or its live share (owner: its holder,
                or the organization), and those of the member it is shared with (owner: that member).
            shares (list[EmailRuleReceiversSharesItem]): The rule's live share (at most one), by its member, if they can
                read it and it is among their newest 20 shares.
     """

    keys: list[EmailRuleReceiversKeysItem]
    webhooks: list[EmailRuleReceiversWebhooksItem]
    shares: list[EmailRuleReceiversSharesItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_receivers_keys_item import EmailRuleReceiversKeysItem # noqa: PLC0415
        from ..models.email_rule_receivers_shares_item import EmailRuleReceiversSharesItem # noqa: PLC0415
        from ..models.email_rule_receivers_webhooks_item import EmailRuleReceiversWebhooksItem # noqa: PLC0415
        keys = []
        for keys_item_data in self.keys:
            keys_item = keys_item_data.to_dict()
            keys.append(keys_item)



        webhooks = []
        for webhooks_item_data in self.webhooks:
            webhooks_item = webhooks_item_data.to_dict()
            webhooks.append(webhooks_item)



        shares = []
        for shares_item_data in self.shares:
            shares_item = shares_item_data.to_dict()
            shares.append(shares_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "keys": keys,
            "webhooks": webhooks,
            "shares": shares,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_receivers_keys_item import EmailRuleReceiversKeysItem # noqa: PLC0415
        from ..models.email_rule_receivers_shares_item import EmailRuleReceiversSharesItem # noqa: PLC0415
        from ..models.email_rule_receivers_webhooks_item import EmailRuleReceiversWebhooksItem # noqa: PLC0415
        d = dict(src_dict)
        keys = []
        _keys = d.pop("keys")
        for keys_item_data in (_keys):
            keys_item = EmailRuleReceiversKeysItem.from_dict(keys_item_data)



            keys.append(keys_item)


        webhooks = []
        _webhooks = d.pop("webhooks")
        for webhooks_item_data in (_webhooks):
            webhooks_item = EmailRuleReceiversWebhooksItem.from_dict(webhooks_item_data)



            webhooks.append(webhooks_item)


        shares = []
        _shares = d.pop("shares")
        for shares_item_data in (_shares):
            shares_item = EmailRuleReceiversSharesItem.from_dict(shares_item_data)



            shares.append(shares_item)


        email_rule_receivers = cls(
            keys=keys,
            webhooks=webhooks,
            shares=shares,
        )


        email_rule_receivers.additional_properties = d
        return email_rule_receivers

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
