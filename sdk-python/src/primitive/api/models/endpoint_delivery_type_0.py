from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.endpoint_delivery_type_0_held_for_owner_type_0 import EndpointDeliveryType0HeldForOwnerType0
  from ..models.endpoint_delivery_type_0_reasons_item import EndpointDeliveryType0ReasonsItem





T = TypeVar("T", bound="EndpointDeliveryType0")



@_attrs_define
class EndpointDeliveryType0:
    """ For a webhook (kind http) in GET /endpoints and GET /endpoints/{id}: whether it is being sent received mail, and why
    not. Shown to anyone who may read the endpoint; it names a state, never a key. Null when it could not be checked
    just now. Absent from other kinds of endpoint and from create and update answers.

        Attributes:
            delivering (bool): Whether the webhook is being sent received mail at all now: it is on, it is not held, and its
                owner can receive mail. Which messages reach it is still decided per message, by routing, rule grants and its
                own rules.
            reasons (list[EndpointDeliveryType0ReasonsItem]): Every reason it is not, in the order delivery checks them;
                empty when it is. Codes, of which more may be added: disabled: the endpoint is off (disabled_reason on the
                endpoint says why). held: the endpoint, or the route the email came through, is held pending an owner or admin
                decision after its creator's access was reduced. acting_owner_revoked, acting_owner_suspended (which covers an
                expired key) and acting_owner_left: its owner cannot act now. acting_owner_permission: its owner does not read
                mail. acting_owner_depth: its owner sees headers only. acting_owner_scope: its owner does not read this email's
                mailbox, or, with no email to judge, reads no received mail at all now. These three name what the owner's access
                holds, so a caller who may not read API key metadata sees acting_owner_access in their place.
            held_for_owner (EndpointDeliveryType0HeldForOwnerType0 | None | Unset): Rule-granted mail held for this webhook
                while its owner cannot act; null when none is. Only for a caller with access to every mailbox (held mail can be
                an earlier owner's), and absent when it could not be read just now.
     """

    delivering: bool
    reasons: list[EndpointDeliveryType0ReasonsItem]
    held_for_owner: EndpointDeliveryType0HeldForOwnerType0 | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.endpoint_delivery_type_0_held_for_owner_type_0 import EndpointDeliveryType0HeldForOwnerType0 # noqa: PLC0415
        from ..models.endpoint_delivery_type_0_reasons_item import EndpointDeliveryType0ReasonsItem # noqa: PLC0415
        delivering = self.delivering

        reasons = []
        for reasons_item_data in self.reasons:
            reasons_item = reasons_item_data.to_dict()
            reasons.append(reasons_item)



        held_for_owner: dict[str, Any] | None | Unset
        if isinstance(self.held_for_owner, Unset):
            held_for_owner = UNSET
        elif isinstance(self.held_for_owner, EndpointDeliveryType0HeldForOwnerType0):
            held_for_owner = self.held_for_owner.to_dict()
        else:
            held_for_owner = self.held_for_owner


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "delivering": delivering,
            "reasons": reasons,
        })
        if held_for_owner is not UNSET:
            field_dict["held_for_owner"] = held_for_owner

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.endpoint_delivery_type_0_held_for_owner_type_0 import EndpointDeliveryType0HeldForOwnerType0 # noqa: PLC0415
        from ..models.endpoint_delivery_type_0_reasons_item import EndpointDeliveryType0ReasonsItem # noqa: PLC0415
        d = dict(src_dict)
        delivering = d.pop("delivering")

        reasons = []
        _reasons = d.pop("reasons")
        for reasons_item_data in (_reasons):
            reasons_item = EndpointDeliveryType0ReasonsItem.from_dict(reasons_item_data)



            reasons.append(reasons_item)


        def _parse_held_for_owner(data: object) -> EndpointDeliveryType0HeldForOwnerType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                held_for_owner_type_0 = EndpointDeliveryType0HeldForOwnerType0.from_dict(data)



                return held_for_owner_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EndpointDeliveryType0HeldForOwnerType0 | None | Unset, data)

        held_for_owner = _parse_held_for_owner(d.pop("held_for_owner", UNSET))


        endpoint_delivery_type_0 = cls(
            delivering=delivering,
            reasons=reasons,
            held_for_owner=held_for_owner,
        )


        endpoint_delivery_type_0.additional_properties = d
        return endpoint_delivery_type_0

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
