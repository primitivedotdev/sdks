from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_notifications_update_email_notification_preferences_input_preferences import EmailNotificationsUpdateEmailNotificationPreferencesInputPreferences





T = TypeVar("T", bound="EmailNotificationsUpdateEmailNotificationPreferencesInput")



@_attrs_define
class EmailNotificationsUpdateEmailNotificationPreferencesInput:
    """ 
        Attributes:
            preferences (EmailNotificationsUpdateEmailNotificationPreferencesInputPreferences):
     """

    preferences: EmailNotificationsUpdateEmailNotificationPreferencesInputPreferences





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_notifications_update_email_notification_preferences_input_preferences import EmailNotificationsUpdateEmailNotificationPreferencesInputPreferences # noqa: PLC0415
        preferences = self.preferences.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "preferences": preferences,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_notifications_update_email_notification_preferences_input_preferences import EmailNotificationsUpdateEmailNotificationPreferencesInputPreferences # noqa: PLC0415
        d = dict(src_dict)
        preferences = EmailNotificationsUpdateEmailNotificationPreferencesInputPreferences.from_dict(d.pop("preferences"))




        email_notifications_update_email_notification_preferences_input = cls(
            preferences=preferences,
        )

        return email_notifications_update_email_notification_preferences_input

