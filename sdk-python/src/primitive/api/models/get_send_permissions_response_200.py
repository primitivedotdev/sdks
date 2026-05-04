from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.send_permission_address import SendPermissionAddress
  from ..models.send_permission_any_recipient import SendPermissionAnyRecipient
  from ..models.send_permission_managed_zone import SendPermissionManagedZone
  from ..models.send_permission_your_domain import SendPermissionYourDomain
  from ..models.send_permissions_meta import SendPermissionsMeta





T = TypeVar("T", bound="GetSendPermissionsResponse200")



@_attrs_define
class GetSendPermissionsResponse200:
    """ 
        Attributes:
            success (bool):
            data (list[SendPermissionAddress | SendPermissionAnyRecipient | SendPermissionManagedZone |
                SendPermissionYourDomain]):
            meta (SendPermissionsMeta): Response metadata for /send-permissions. The `address_cap`
                bounds the size of the `address` rule subset; orgs with more
                than `address_cap` known addresses almost always also hold a
                broader rule type (`any_recipient` or `your_domain`), so the
                cap is a response-size bound rather than a meaningful
                product limit.
     """

    success: bool
    data: list[SendPermissionAddress | SendPermissionAnyRecipient | SendPermissionManagedZone | SendPermissionYourDomain]
    meta: SendPermissionsMeta
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.send_permission_address import SendPermissionAddress
        from ..models.send_permission_any_recipient import SendPermissionAnyRecipient
        from ..models.send_permission_managed_zone import SendPermissionManagedZone
        from ..models.send_permission_your_domain import SendPermissionYourDomain
        from ..models.send_permissions_meta import SendPermissionsMeta
        success = self.success

        data = []
        for data_item_data in self.data:
            data_item: dict[str, Any]
            if isinstance(data_item_data, SendPermissionAnyRecipient):
                data_item = data_item_data.to_dict()
            elif isinstance(data_item_data, SendPermissionManagedZone):
                data_item = data_item_data.to_dict()
            elif isinstance(data_item_data, SendPermissionYourDomain):
                data_item = data_item_data.to_dict()
            else:
                data_item = data_item_data.to_dict()

            data.append(data_item)



        meta = self.meta.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "success": success,
            "data": data,
            "meta": meta,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.send_permission_address import SendPermissionAddress
        from ..models.send_permission_any_recipient import SendPermissionAnyRecipient
        from ..models.send_permission_managed_zone import SendPermissionManagedZone
        from ..models.send_permission_your_domain import SendPermissionYourDomain
        from ..models.send_permissions_meta import SendPermissionsMeta
        d = dict(src_dict)
        success = d.pop("success")

        data = []
        _data = d.pop("data")
        for data_item_data in (_data):
            def _parse_data_item(data: object) -> SendPermissionAddress | SendPermissionAnyRecipient | SendPermissionManagedZone | SendPermissionYourDomain:
                try:
                    if not isinstance(data, dict):
                        raise TypeError()
                    componentsschemas_send_permission_rule_type_0 = SendPermissionAnyRecipient.from_dict(data)



                    return componentsschemas_send_permission_rule_type_0
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                try:
                    if not isinstance(data, dict):
                        raise TypeError()
                    componentsschemas_send_permission_rule_type_1 = SendPermissionManagedZone.from_dict(data)



                    return componentsschemas_send_permission_rule_type_1
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                try:
                    if not isinstance(data, dict):
                        raise TypeError()
                    componentsschemas_send_permission_rule_type_2 = SendPermissionYourDomain.from_dict(data)



                    return componentsschemas_send_permission_rule_type_2
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_send_permission_rule_type_3 = SendPermissionAddress.from_dict(data)



                return componentsschemas_send_permission_rule_type_3

            data_item = _parse_data_item(data_item_data)

            data.append(data_item)


        meta = SendPermissionsMeta.from_dict(d.pop("meta"))




        get_send_permissions_response_200 = cls(
            success=success,
            data=data,
            meta=meta,
        )


        get_send_permissions_response_200.additional_properties = d
        return get_send_permissions_response_200

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
