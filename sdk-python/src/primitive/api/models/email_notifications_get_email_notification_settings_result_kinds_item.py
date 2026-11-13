from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_notifications_get_email_notification_settings_result_kinds_item_class import EmailNotificationsGetEmailNotificationSettingsResultKindsItemClass
from ..models.email_notifications_get_email_notification_settings_result_kinds_item_org_mode_type_1 import EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType1
from ..models.email_notifications_get_email_notification_settings_result_kinds_item_org_mode_type_2_type_1 import EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType2Type1
from ..models.email_notifications_get_email_notification_settings_result_kinds_item_org_mode_type_3_type_1 import EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType3Type1
from ..models.email_notifications_get_email_notification_settings_result_kinds_item_org_modes_item import EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModesItem
from typing import cast






T = TypeVar("T", bound="EmailNotificationsGetEmailNotificationSettingsResultKindsItem")



@_attrs_define
class EmailNotificationsGetEmailNotificationSettingsResultKindsItem:
    """ 
        Attributes:
            kind (str):
            label (str):
            description (str):
            class_ (EmailNotificationsGetEmailNotificationSettingsResultKindsItemClass):
            entitlement_required (bool):
            entitled (bool):
            org_mode (EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType1 |
                EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType2Type1 |
                EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType3Type1 | None):
            org_mode_is_default (bool):
            org_modes (list[EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModesItem]):
            member_enabled (bool):
            member_can_change (bool):
     """

    kind: str
    label: str
    description: str
    class_: EmailNotificationsGetEmailNotificationSettingsResultKindsItemClass
    entitlement_required: bool
    entitled: bool
    org_mode: EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType1 | EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType2Type1 | EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType3Type1 | None
    org_mode_is_default: bool
    org_modes: list[EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModesItem]
    member_enabled: bool
    member_can_change: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        label = self.label

        description = self.description

        class_ = self.class_.value

        entitlement_required = self.entitlement_required

        entitled = self.entitled

        org_mode: None | str
        if isinstance(self.org_mode, EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType1):
            org_mode = self.org_mode.value
        elif isinstance(self.org_mode, EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType2Type1):
            org_mode = self.org_mode.value
        elif isinstance(self.org_mode, EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType3Type1):
            org_mode = self.org_mode.value
        else:
            org_mode = self.org_mode

        org_mode_is_default = self.org_mode_is_default

        org_modes = []
        for org_modes_item_data in self.org_modes:
            org_modes_item = org_modes_item_data.value
            org_modes.append(org_modes_item)



        member_enabled = self.member_enabled

        member_can_change = self.member_can_change


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
            "label": label,
            "description": description,
            "class": class_,
            "entitlement_required": entitlement_required,
            "entitled": entitled,
            "org_mode": org_mode,
            "org_mode_is_default": org_mode_is_default,
            "org_modes": org_modes,
            "member_enabled": member_enabled,
            "member_can_change": member_can_change,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = d.pop("kind")

        label = d.pop("label")

        description = d.pop("description")

        class_ = EmailNotificationsGetEmailNotificationSettingsResultKindsItemClass(d.pop("class"))




        entitlement_required = d.pop("entitlement_required")

        entitled = d.pop("entitled")

        def _parse_org_mode(data: object) -> EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType1 | EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType2Type1 | EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType3Type1 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                org_mode_type_1 = EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType1(data)



                return org_mode_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                org_mode_type_2_type_1 = EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType2Type1(data)



                return org_mode_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                org_mode_type_3_type_1 = EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType3Type1(data)



                return org_mode_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType1 | EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType2Type1 | EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModeType3Type1 | None, data)

        org_mode = _parse_org_mode(d.pop("org_mode"))


        org_mode_is_default = d.pop("org_mode_is_default")

        org_modes = []
        _org_modes = d.pop("org_modes")
        for org_modes_item_data in (_org_modes):
            org_modes_item = EmailNotificationsGetEmailNotificationSettingsResultKindsItemOrgModesItem(org_modes_item_data)



            org_modes.append(org_modes_item)


        member_enabled = d.pop("member_enabled")

        member_can_change = d.pop("member_can_change")

        email_notifications_get_email_notification_settings_result_kinds_item = cls(
            kind=kind,
            label=label,
            description=description,
            class_=class_,
            entitlement_required=entitlement_required,
            entitled=entitled,
            org_mode=org_mode,
            org_mode_is_default=org_mode_is_default,
            org_modes=org_modes,
            member_enabled=member_enabled,
            member_can_change=member_can_change,
        )


        email_notifications_get_email_notification_settings_result_kinds_item.additional_properties = d
        return email_notifications_get_email_notification_settings_result_kinds_item

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
