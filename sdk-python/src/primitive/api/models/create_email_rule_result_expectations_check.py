from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="CreateEmailRuleResultExpectationsCheck")



@_attrs_define
class CreateEmailRuleResultExpectationsCheck:
    """ After a write that saved a version or changed its expectations, if it has some: them, judged on that version from
    stored classifications without asking its questions. Undecided: one that needs answers not yet kept for that
    version, is unclassified, skipped or not reached, or that its author does not read. Absent when it could not be
    judged (the rule changed again, its author cannot be resolved, your access shows headers only, it could not finish
    in time, or the check failed). Test by rule_id for the rest.

        Attributes:
            version (int | None):
            passed (bool | None): False when any failed, true when every one passed, null when none failed but some are
                undecided (not a failure).
            failed (list[UUID]):
            undecided (list[UUID]):
            decided (bool | Unset): Whether every expectation was judged (undecided is empty). Absent from a server that
                predates it.
     """

    version: int | None
    passed: bool | None
    failed: list[UUID]
    undecided: list[UUID]
    decided: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        version: int | None
        version = self.version

        passed: bool | None
        passed = self.passed

        failed = []
        for failed_item_data in self.failed:
            failed_item = str(failed_item_data)
            failed.append(failed_item)



        undecided = []
        for undecided_item_data in self.undecided:
            undecided_item = str(undecided_item_data)
            undecided.append(undecided_item)



        decided = self.decided


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "version": version,
            "passed": passed,
            "failed": failed,
            "undecided": undecided,
        })
        if decided is not UNSET:
            field_dict["decided"] = decided

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_version(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        version = _parse_version(d.pop("version"))


        def _parse_passed(data: object) -> bool | None:
            if data is None:
                return data
            return cast(bool | None, data)

        passed = _parse_passed(d.pop("passed"))


        failed = []
        _failed = d.pop("failed")
        for failed_item_data in (_failed):
            failed_item = UUID(failed_item_data)



            failed.append(failed_item)


        undecided = []
        _undecided = d.pop("undecided")
        for undecided_item_data in (_undecided):
            undecided_item = UUID(undecided_item_data)



            undecided.append(undecided_item)


        decided = d.pop("decided", UNSET)

        create_email_rule_result_expectations_check = cls(
            version=version,
            passed=passed,
            failed=failed,
            undecided=undecided,
            decided=decided,
        )


        create_email_rule_result_expectations_check.additional_properties = d
        return create_email_rule_result_expectations_check

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
