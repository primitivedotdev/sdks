from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.email_rule_expectation_sample_input import EmailRuleExpectationSampleInput





T = TypeVar("T", bound="TestEmailRuleRequestExpect")



@_attrs_define
class TestEmailRuleRequestExpect:
    """ Emails the rule must match and must not (at most 100), always tested whatever their age, and made-up emails
    (samples, at most 20). Given, it replaces a saved rule's own.

        Attributes:
            match (list[UUID] | Unset):
            no_match (list[UUID] | Unset):
            samples (list[EmailRuleExpectationSampleInput] | Unset):
     """

    match: list[UUID] | Unset = UNSET
    no_match: list[UUID] | Unset = UNSET
    samples: list[EmailRuleExpectationSampleInput] | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_expectation_sample_input import EmailRuleExpectationSampleInput # noqa: PLC0415
        match: list[str] | Unset = UNSET
        if not isinstance(self.match, Unset):
            match = []
            for match_item_data in self.match:
                match_item = str(match_item_data)
                match.append(match_item)



        no_match: list[str] | Unset = UNSET
        if not isinstance(self.no_match, Unset):
            no_match = []
            for no_match_item_data in self.no_match:
                no_match_item = str(no_match_item_data)
                no_match.append(no_match_item)



        samples: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.samples, Unset):
            samples = []
            for samples_item_data in self.samples:
                samples_item = samples_item_data.to_dict()
                samples.append(samples_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if match is not UNSET:
            field_dict["match"] = match
        if no_match is not UNSET:
            field_dict["no_match"] = no_match
        if samples is not UNSET:
            field_dict["samples"] = samples

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_expectation_sample_input import EmailRuleExpectationSampleInput # noqa: PLC0415
        d = dict(src_dict)
        _match = d.pop("match", UNSET)
        match: list[UUID] | Unset = UNSET
        if _match is not UNSET:
            match = []
            for match_item_data in _match:
                match_item = UUID(match_item_data)



                match.append(match_item)


        _no_match = d.pop("no_match", UNSET)
        no_match: list[UUID] | Unset = UNSET
        if _no_match is not UNSET:
            no_match = []
            for no_match_item_data in _no_match:
                no_match_item = UUID(no_match_item_data)



                no_match.append(no_match_item)


        _samples = d.pop("samples", UNSET)
        samples: list[EmailRuleExpectationSampleInput] | Unset = UNSET
        if _samples is not UNSET:
            samples = []
            for samples_item_data in _samples:
                samples_item = EmailRuleExpectationSampleInput.from_dict(samples_item_data)



                samples.append(samples_item)


        test_email_rule_request_expect = cls(
            match=match,
            no_match=no_match,
            samples=samples,
        )

        return test_email_rule_request_expect

