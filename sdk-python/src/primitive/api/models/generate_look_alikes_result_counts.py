from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_sample_group_counts import EmailRuleSampleGroupCounts





T = TypeVar("T", bound="GenerateLookAlikesResultCounts")



@_attrs_define
class GenerateLookAlikesResultCounts:
    """ 
        Attributes:
            passed (int):
            failed (int):
            undecided (int):
            close_calls (int):
            dropped (int): Asked for but not returned: not written, outside the sample bounds, or of a kind and expected not
                asked for.
            by_group (EmailRuleSampleGroupCounts):
     """

    passed: int
    failed: int
    undecided: int
    close_calls: int
    dropped: int
    by_group: EmailRuleSampleGroupCounts
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_sample_group_counts import EmailRuleSampleGroupCounts # noqa: PLC0415
        passed = self.passed

        failed = self.failed

        undecided = self.undecided

        close_calls = self.close_calls

        dropped = self.dropped

        by_group = self.by_group.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "passed": passed,
            "failed": failed,
            "undecided": undecided,
            "close_calls": close_calls,
            "dropped": dropped,
            "by_group": by_group,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_sample_group_counts import EmailRuleSampleGroupCounts # noqa: PLC0415
        d = dict(src_dict)
        passed = d.pop("passed")

        failed = d.pop("failed")

        undecided = d.pop("undecided")

        close_calls = d.pop("close_calls")

        dropped = d.pop("dropped")

        by_group = EmailRuleSampleGroupCounts.from_dict(d.pop("by_group"))




        generate_look_alikes_result_counts = cls(
            passed=passed,
            failed=failed,
            undecided=undecided,
            close_calls=close_calls,
            dropped=dropped,
            by_group=by_group,
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
