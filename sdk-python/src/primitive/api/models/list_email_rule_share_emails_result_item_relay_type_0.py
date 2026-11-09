from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.list_email_rule_share_emails_result_item_relay_type_0_via import ListEmailRuleShareEmailsResultItemRelayType0Via
from typing import cast

if TYPE_CHECKING:
  from ..models.list_email_rule_share_emails_result_item_relay_type_0_delivery_item import ListEmailRuleShareEmailsResultItemRelayType0DeliveryItem





T = TypeVar("T", bound="ListEmailRuleShareEmailsResultItemRelayType0")



@_attrs_define
class ListEmailRuleShareEmailsResultItemRelayType0:
    """ 
        Attributes:
            hostname (str):
            via (ListEmailRuleShareEmailsResultItemRelayType0Via):
            delivery (list[ListEmailRuleShareEmailsResultItemRelayType0DeliveryItem] | Unset):
     """

    hostname: str
    via: ListEmailRuleShareEmailsResultItemRelayType0Via
    delivery: list[ListEmailRuleShareEmailsResultItemRelayType0DeliveryItem] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_email_rule_share_emails_result_item_relay_type_0_delivery_item import ListEmailRuleShareEmailsResultItemRelayType0DeliveryItem # noqa: PLC0415
        hostname = self.hostname

        via = self.via.value

        delivery: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.delivery, Unset):
            delivery = []
            for delivery_item_data in self.delivery:
                delivery_item = delivery_item_data.to_dict()
                delivery.append(delivery_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "hostname": hostname,
            "via": via,
        })
        if delivery is not UNSET:
            field_dict["delivery"] = delivery

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_email_rule_share_emails_result_item_relay_type_0_delivery_item import ListEmailRuleShareEmailsResultItemRelayType0DeliveryItem # noqa: PLC0415
        d = dict(src_dict)
        hostname = d.pop("hostname")

        via = ListEmailRuleShareEmailsResultItemRelayType0Via(d.pop("via"))




        _delivery = d.pop("delivery", UNSET)
        delivery: list[ListEmailRuleShareEmailsResultItemRelayType0DeliveryItem] | Unset = UNSET
        if _delivery is not UNSET:
            delivery = []
            for delivery_item_data in _delivery:
                delivery_item = ListEmailRuleShareEmailsResultItemRelayType0DeliveryItem.from_dict(delivery_item_data)



                delivery.append(delivery_item)


        list_email_rule_share_emails_result_item_relay_type_0 = cls(
            hostname=hostname,
            via=via,
            delivery=delivery,
        )


        list_email_rule_share_emails_result_item_relay_type_0.additional_properties = d
        return list_email_rule_share_emails_result_item_relay_type_0

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
