from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.contact_policy_rule_effect import ContactPolicyRuleEffect
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="ContactPolicyRule")



@_attrs_define
class ContactPolicyRule:
    """ 
        Attributes:
            pattern (str): Trim outer whitespace, then require ASCII before lowercase normalization. Exact mailbox or
                restricted mailbox glob. See operation description.
            effect (ContactPolicyRuleEffect):
            notify_since (datetime.datetime | None):
            notification_generation (None | UUID):
     """

    pattern: str
    effect: ContactPolicyRuleEffect
    notify_since: datetime.datetime | None
    notification_generation: None | UUID





    def to_dict(self) -> dict[str, Any]:
        pattern = self.pattern

        effect = self.effect.value

        notify_since: None | str
        if isinstance(self.notify_since, datetime.datetime):
            notify_since = self.notify_since.isoformat()
        else:
            notify_since = self.notify_since

        notification_generation: None | str
        if isinstance(self.notification_generation, UUID):
            notification_generation = str(self.notification_generation)
        else:
            notification_generation = self.notification_generation


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "pattern": pattern,
            "effect": effect,
            "notify_since": notify_since,
            "notification_generation": notification_generation,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        pattern = d.pop("pattern")

        effect = ContactPolicyRuleEffect(d.pop("effect"))




        def _parse_notify_since(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                notify_since_type_0 = isoparse(data)



                return notify_since_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        notify_since = _parse_notify_since(d.pop("notify_since"))


        def _parse_notification_generation(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                notification_generation_type_0 = UUID(data)



                return notification_generation_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        notification_generation = _parse_notification_generation(d.pop("notification_generation"))


        contact_policy_rule = cls(
            pattern=pattern,
            effect=effect,
            notify_since=notify_since,
            notification_generation=notification_generation,
        )

        return contact_policy_rule

