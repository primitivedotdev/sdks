from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.set_access_mode_result_mode import SetAccessModeResultMode






T = TypeVar("T", bound="SetAccessModeResult")



@_attrs_define
class SetAccessModeResult:
    """ 
        Attributes:
            mode (SetAccessModeResultMode):
            changed (bool):
            items_listed (Any | Unset):
            revoked (Any | Unset):
            settled (float | Unset):
            shared_agents_narrowed (float | Unset):
     """

    mode: SetAccessModeResultMode
    changed: bool
    items_listed: Any | Unset = UNSET
    revoked: Any | Unset = UNSET
    settled: float | Unset = UNSET
    shared_agents_narrowed: float | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        mode = self.mode.value

        changed = self.changed

        items_listed = self.items_listed

        revoked = self.revoked

        settled = self.settled

        shared_agents_narrowed = self.shared_agents_narrowed


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "mode": mode,
            "changed": changed,
        })
        if items_listed is not UNSET:
            field_dict["items_listed"] = items_listed
        if revoked is not UNSET:
            field_dict["revoked"] = revoked
        if settled is not UNSET:
            field_dict["settled"] = settled
        if shared_agents_narrowed is not UNSET:
            field_dict["shared_agents_narrowed"] = shared_agents_narrowed

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        mode = SetAccessModeResultMode(d.pop("mode"))




        changed = d.pop("changed")

        items_listed = d.pop("items_listed", UNSET)

        revoked = d.pop("revoked", UNSET)

        settled = d.pop("settled", UNSET)

        shared_agents_narrowed = d.pop("shared_agents_narrowed", UNSET)

        set_access_mode_result = cls(
            mode=mode,
            changed=changed,
            items_listed=items_listed,
            revoked=revoked,
            settled=settled,
            shared_agents_narrowed=shared_agents_narrowed,
        )


        set_access_mode_result.additional_properties = d
        return set_access_mode_result

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
