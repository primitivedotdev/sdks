from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.email_rule_sample_detail import EmailRuleSampleDetail





T = TypeVar("T", bound="CreateEmailRuleResultExpectationsCheck")



@_attrs_define
class CreateEmailRuleResultExpectationsCheck:
    """ After a write that saved a version or changed its expectations or made-up emails, if it has some: the emails by id
    judged on that version from stored classifications without asking its questions, and any made-up emails listed as
    undecided. Undecided: one that needs answers not yet kept for that version, is unclassified, skipped or not reached,
    or that its author does not read. Absent when it could not be judged (the rule changed again, its author cannot be
    resolved, your access shows headers only, it could not finish in time, or the check failed), and after a write that
    changed only made-up emails on a rule with emails by id. Test by rule_id for the rest. With if_expectations_pass,
    the judgment made before the save, which passed.

        Attributes:
            version (int | None):
            passed (bool | None): False when any failed, true when every one passed, null when none failed but some are
                undecided (not a failure).
            failed (list[UUID]):
            undecided (list[UUID]):
            decided (bool | Unset): Whether every expectation was judged (undecided and undecided_samples are empty). Absent
                from a server that predates it.
            failed_samples (list[int] | Unset): Made-up emails that failed, by index in the set judged (saved oldest first,
                then added; or as sent).
            undecided_samples (list[int] | Unset): Made-up emails not decided, by index. Only a write that saves a version
                or activates the rule, sent with if_expectations_pass or judged by default, judges them.
            failed_sample_details (list[EmailRuleSampleDetail] | Unset): failed_samples with each one's label, from a write
                that judged them before saving (if_expectations_pass, or by default).
            undecided_sample_details (list[EmailRuleSampleDetail] | Unset): undecided_samples with each one's label, as
                failed_sample_details.
            note (str | Unset): On an update that saved a version that did not pass, or a do_not_share rule created active:
                that it was saved anyway, is current, and whether it is live.
     """

    version: int | None
    passed: bool | None
    failed: list[UUID]
    undecided: list[UUID]
    decided: bool | Unset = UNSET
    failed_samples: list[int] | Unset = UNSET
    undecided_samples: list[int] | Unset = UNSET
    failed_sample_details: list[EmailRuleSampleDetail] | Unset = UNSET
    undecided_sample_details: list[EmailRuleSampleDetail] | Unset = UNSET
    note: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_sample_detail import EmailRuleSampleDetail # noqa: PLC0415
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

        failed_samples: list[int] | Unset = UNSET
        if not isinstance(self.failed_samples, Unset):
            failed_samples = self.failed_samples



        undecided_samples: list[int] | Unset = UNSET
        if not isinstance(self.undecided_samples, Unset):
            undecided_samples = self.undecided_samples



        failed_sample_details: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.failed_sample_details, Unset):
            failed_sample_details = []
            for failed_sample_details_item_data in self.failed_sample_details:
                failed_sample_details_item = failed_sample_details_item_data.to_dict()
                failed_sample_details.append(failed_sample_details_item)



        undecided_sample_details: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.undecided_sample_details, Unset):
            undecided_sample_details = []
            for undecided_sample_details_item_data in self.undecided_sample_details:
                undecided_sample_details_item = undecided_sample_details_item_data.to_dict()
                undecided_sample_details.append(undecided_sample_details_item)



        note = self.note


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
        if failed_samples is not UNSET:
            field_dict["failed_samples"] = failed_samples
        if undecided_samples is not UNSET:
            field_dict["undecided_samples"] = undecided_samples
        if failed_sample_details is not UNSET:
            field_dict["failed_sample_details"] = failed_sample_details
        if undecided_sample_details is not UNSET:
            field_dict["undecided_sample_details"] = undecided_sample_details
        if note is not UNSET:
            field_dict["note"] = note

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_sample_detail import EmailRuleSampleDetail # noqa: PLC0415
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

        failed_samples = cast(list[int], d.pop("failed_samples", UNSET))


        undecided_samples = cast(list[int], d.pop("undecided_samples", UNSET))


        _failed_sample_details = d.pop("failed_sample_details", UNSET)
        failed_sample_details: list[EmailRuleSampleDetail] | Unset = UNSET
        if _failed_sample_details is not UNSET:
            failed_sample_details = []
            for failed_sample_details_item_data in _failed_sample_details:
                failed_sample_details_item = EmailRuleSampleDetail.from_dict(failed_sample_details_item_data)



                failed_sample_details.append(failed_sample_details_item)


        _undecided_sample_details = d.pop("undecided_sample_details", UNSET)
        undecided_sample_details: list[EmailRuleSampleDetail] | Unset = UNSET
        if _undecided_sample_details is not UNSET:
            undecided_sample_details = []
            for undecided_sample_details_item_data in _undecided_sample_details:
                undecided_sample_details_item = EmailRuleSampleDetail.from_dict(undecided_sample_details_item_data)



                undecided_sample_details.append(undecided_sample_details_item)


        note = d.pop("note", UNSET)

        create_email_rule_result_expectations_check = cls(
            version=version,
            passed=passed,
            failed=failed,
            undecided=undecided,
            decided=decided,
            failed_samples=failed_samples,
            undecided_samples=undecided_samples,
            failed_sample_details=failed_sample_details,
            undecided_sample_details=undecided_sample_details,
            note=note,
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
