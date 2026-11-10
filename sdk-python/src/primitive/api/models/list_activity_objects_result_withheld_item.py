from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.list_activity_objects_result_withheld_item_reason import ListActivityObjectsResultWithheldItemReason
from typing import cast






T = TypeVar("T", bound="ListActivityObjectsResultWithheldItem")



@_attrs_define
class ListActivityObjectsResultWithheldItem:
    """ 
        Attributes:
            kind (str):
            reason (ListActivityObjectsResultWithheldItemReason): permission_missing: the caller lacks the permission the
                kind's own list needs (named in permission). mail_scope: listed only to a caller that reads every mailbox.
                not_for_this_credential: this kind of credential never lists them (a person's own kinds asked for by a key, an
                app or an agent).
            permission (None | str):
     """

    kind: str
    reason: ListActivityObjectsResultWithheldItemReason
    permission: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        reason = self.reason.value

        permission: None | str
        permission = self.permission


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
            "reason": reason,
            "permission": permission,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = d.pop("kind")

        reason = ListActivityObjectsResultWithheldItemReason(d.pop("reason"))




        def _parse_permission(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        permission = _parse_permission(d.pop("permission"))


        list_activity_objects_result_withheld_item = cls(
            kind=kind,
            reason=reason,
            permission=permission,
        )


        list_activity_objects_result_withheld_item.additional_properties = d
        return list_activity_objects_result_withheld_item

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
