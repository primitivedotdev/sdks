from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_notifications_update_email_notification_preferences_result_kinds_item import EmailNotificationsUpdateEmailNotificationPreferencesResultKindsItem





T = TypeVar("T", bound="EmailNotificationsUpdateEmailNotificationPreferencesResult")



@_attrs_define
class EmailNotificationsUpdateEmailNotificationPreferencesResult:
    """ 
        Attributes:
            entitled (bool):
            kinds (list[EmailNotificationsUpdateEmailNotificationPreferencesResultKindsItem]):
     """

    entitled: bool
    kinds: list[EmailNotificationsUpdateEmailNotificationPreferencesResultKindsItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_notifications_update_email_notification_preferences_result_kinds_item import EmailNotificationsUpdateEmailNotificationPreferencesResultKindsItem # noqa: PLC0415
        entitled = self.entitled

        kinds = []
        for kinds_item_data in self.kinds:
            kinds_item = kinds_item_data.to_dict()
            kinds.append(kinds_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "entitled": entitled,
            "kinds": kinds,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_notifications_update_email_notification_preferences_result_kinds_item import EmailNotificationsUpdateEmailNotificationPreferencesResultKindsItem # noqa: PLC0415
        d = dict(src_dict)
        entitled = d.pop("entitled")

        kinds = []
        _kinds = d.pop("kinds")
        for kinds_item_data in (_kinds):
            kinds_item = EmailNotificationsUpdateEmailNotificationPreferencesResultKindsItem.from_dict(kinds_item_data)



            kinds.append(kinds_item)


        email_notifications_update_email_notification_preferences_result = cls(
            entitled=entitled,
            kinds=kinds,
        )


        email_notifications_update_email_notification_preferences_result.additional_properties = d
        return email_notifications_update_email_notification_preferences_result

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
