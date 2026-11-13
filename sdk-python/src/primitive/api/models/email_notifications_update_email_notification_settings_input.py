from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_notifications_update_email_notification_settings_input_modes import EmailNotificationsUpdateEmailNotificationSettingsInputModes





T = TypeVar("T", bound="EmailNotificationsUpdateEmailNotificationSettingsInput")



@_attrs_define
class EmailNotificationsUpdateEmailNotificationSettingsInput:
    """ 
        Attributes:
            modes (EmailNotificationsUpdateEmailNotificationSettingsInputModes):
     """

    modes: EmailNotificationsUpdateEmailNotificationSettingsInputModes





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_notifications_update_email_notification_settings_input_modes import EmailNotificationsUpdateEmailNotificationSettingsInputModes # noqa: PLC0415
        modes = self.modes.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "modes": modes,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_notifications_update_email_notification_settings_input_modes import EmailNotificationsUpdateEmailNotificationSettingsInputModes # noqa: PLC0415
        d = dict(src_dict)
        modes = EmailNotificationsUpdateEmailNotificationSettingsInputModes.from_dict(d.pop("modes"))




        email_notifications_update_email_notification_settings_input = cls(
            modes=modes,
        )

        return email_notifications_update_email_notification_settings_input

