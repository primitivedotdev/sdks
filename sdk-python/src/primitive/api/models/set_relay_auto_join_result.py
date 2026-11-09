from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.set_relay_auto_join_result_options_item import SetRelayAutoJoinResultOptionsItem





T = TypeVar("T", bound="SetRelayAutoJoinResult")



@_attrs_define
class SetRelayAutoJoinResult:
    """ 
        Attributes:
            option (None | str):
            options (list[SetRelayAutoJoinResultOptionsItem]):
            changed (bool):
     """

    option: None | str
    options: list[SetRelayAutoJoinResultOptionsItem]
    changed: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.set_relay_auto_join_result_options_item import SetRelayAutoJoinResultOptionsItem # noqa: PLC0415
        option: None | str
        option = self.option

        options = []
        for options_item_data in self.options:
            options_item = options_item_data.to_dict()
            options.append(options_item)



        changed = self.changed


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "option": option,
            "options": options,
            "changed": changed,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.set_relay_auto_join_result_options_item import SetRelayAutoJoinResultOptionsItem # noqa: PLC0415
        d = dict(src_dict)
        def _parse_option(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        option = _parse_option(d.pop("option"))


        options = []
        _options = d.pop("options")
        for options_item_data in (_options):
            options_item = SetRelayAutoJoinResultOptionsItem.from_dict(options_item_data)



            options.append(options_item)


        changed = d.pop("changed")

        set_relay_auto_join_result = cls(
            option=option,
            options=options,
            changed=changed,
        )


        set_relay_auto_join_result.additional_properties = d
        return set_relay_auto_join_result

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
