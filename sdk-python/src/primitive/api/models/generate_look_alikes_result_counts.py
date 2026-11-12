from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="GenerateLookAlikesResultCounts")



@_attrs_define
class GenerateLookAlikesResultCounts:
    """ 
        Attributes:
            passed (int):
            failed (int):
            undecided (int):
            dropped (int): Asked for but not returned: not written, outside the sample bounds, or of a kind not asked for.
     """

    passed: int
    failed: int
    undecided: int
    dropped: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        passed = self.passed

        failed = self.failed

        undecided = self.undecided

        dropped = self.dropped


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "passed": passed,
            "failed": failed,
            "undecided": undecided,
            "dropped": dropped,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        passed = d.pop("passed")

        failed = d.pop("failed")

        undecided = d.pop("undecided")

        dropped = d.pop("dropped")

        generate_look_alikes_result_counts = cls(
            passed=passed,
            failed=failed,
            undecided=undecided,
            dropped=dropped,
        )


        generate_look_alikes_result_counts.additional_properties = d
        return generate_look_alikes_result_counts

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
