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





T = TypeVar("T", bound="EmailRuleExpectationsCheck")



@_attrs_define
class EmailRuleExpectationsCheck:
    """ 
        Attributes:
            version (int | None): The version judged, once saved; null in a refusal.
            passed (bool): Whether every expectation passed.
            failed (list[UUID]): Emails by id that failed.
            undecided (list[UUID]): Emails by id not decided.
            failed_samples (list[EmailRuleSampleDetail]): Made-up emails that failed, by index in the set judged and label.
            undecided_samples (list[EmailRuleSampleDetail]): Made-up emails not decided.
     """

    version: int | None
    passed: bool
    failed: list[UUID]
    undecided: list[UUID]
    failed_samples: list[EmailRuleSampleDetail]
    undecided_samples: list[EmailRuleSampleDetail]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_sample_detail import EmailRuleSampleDetail # noqa: PLC0415
        version: int | None
        version = self.version

        passed = self.passed

        failed = []
        for failed_item_data in self.failed:
            failed_item = str(failed_item_data)
            failed.append(failed_item)



        undecided = []
        for undecided_item_data in self.undecided:
            undecided_item = str(undecided_item_data)
            undecided.append(undecided_item)



        failed_samples = []
        for failed_samples_item_data in self.failed_samples:
            failed_samples_item = failed_samples_item_data.to_dict()
            failed_samples.append(failed_samples_item)



        undecided_samples = []
        for undecided_samples_item_data in self.undecided_samples:
            undecided_samples_item = undecided_samples_item_data.to_dict()
            undecided_samples.append(undecided_samples_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "version": version,
            "passed": passed,
            "failed": failed,
            "undecided": undecided,
            "failed_samples": failed_samples,
            "undecided_samples": undecided_samples,
        })

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


        passed = d.pop("passed")

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


        failed_samples = []
        _failed_samples = d.pop("failed_samples")
        for failed_samples_item_data in (_failed_samples):
            failed_samples_item = EmailRuleSampleDetail.from_dict(failed_samples_item_data)



            failed_samples.append(failed_samples_item)


        undecided_samples = []
        _undecided_samples = d.pop("undecided_samples")
        for undecided_samples_item_data in (_undecided_samples):
            undecided_samples_item = EmailRuleSampleDetail.from_dict(undecided_samples_item_data)



            undecided_samples.append(undecided_samples_item)


        email_rule_expectations_check = cls(
            version=version,
            passed=passed,
            failed=failed,
            undecided=undecided,
            failed_samples=failed_samples,
            undecided_samples=undecided_samples,
        )


        email_rule_expectations_check.additional_properties = d
        return email_rule_expectations_check

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
