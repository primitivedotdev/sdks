from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_rule_expectation_sample_expected import EmailRuleExpectationSampleExpected
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.email_rule_saved_sample_email import EmailRuleSavedSampleEmail





T = TypeVar("T", bound="EmailRuleExpectationSample")



@_attrs_define
class EmailRuleExpectationSample:
    """ 
        Attributes:
            id (UUID):
            expected (EmailRuleExpectationSampleExpected):
            label (None | str):
            email (EmailRuleSavedSampleEmail): A made-up email, as POST /email-rules/test-sample takes it.
            created_at (datetime.datetime):
     """

    id: UUID
    expected: EmailRuleExpectationSampleExpected
    label: None | str
    email: EmailRuleSavedSampleEmail
    created_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_saved_sample_email import EmailRuleSavedSampleEmail # noqa: PLC0415
        id = str(self.id)

        expected = self.expected.value

        label: None | str
        label = self.label

        email = self.email.to_dict()

        created_at = self.created_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "expected": expected,
            "label": label,
            "email": email,
            "created_at": created_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_saved_sample_email import EmailRuleSavedSampleEmail # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        expected = EmailRuleExpectationSampleExpected(d.pop("expected"))




        def _parse_label(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        label = _parse_label(d.pop("label"))


        email = EmailRuleSavedSampleEmail.from_dict(d.pop("email"))




        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        email_rule_expectation_sample = cls(
            id=id,
            expected=expected,
            label=label,
            email=email,
            created_at=created_at,
        )


        email_rule_expectation_sample.additional_properties = d
        return email_rule_expectation_sample

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
