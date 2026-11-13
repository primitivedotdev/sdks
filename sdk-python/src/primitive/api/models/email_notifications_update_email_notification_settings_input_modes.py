from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_notifications_update_email_notification_settings_input_modes_additional_property import EmailNotificationsUpdateEmailNotificationSettingsInputModesAdditionalProperty






T = TypeVar("T", bound="EmailNotificationsUpdateEmailNotificationSettingsInputModes")



@_attrs_define
class EmailNotificationsUpdateEmailNotificationSettingsInputModes:
    

    additional_properties: dict[str, EmailNotificationsUpdateEmailNotificationSettingsInputModesAdditionalProperty] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        
        field_dict: dict[str, Any] = {}
        for prop_name, prop in self.additional_properties.items():
            field_dict[prop_name] = prop.value


        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        email_notifications_update_email_notification_settings_input_modes = cls(
        )


        additional_properties = {}
        for prop_name, prop_dict in d.items():
            additional_property = EmailNotificationsUpdateEmailNotificationSettingsInputModesAdditionalProperty(prop_dict)



            additional_properties[prop_name] = additional_property

        email_notifications_update_email_notification_settings_input_modes.additional_properties = additional_properties
        return email_notifications_update_email_notification_settings_input_modes

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> EmailNotificationsUpdateEmailNotificationSettingsInputModesAdditionalProperty:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: EmailNotificationsUpdateEmailNotificationSettingsInputModesAdditionalProperty) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
