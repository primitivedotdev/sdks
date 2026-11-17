from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_rule_test_sample_input_expected import EmailRuleTestSampleInputExpected
from ..models.email_rule_test_sample_input_group import EmailRuleTestSampleInputGroup
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.email_rule_saved_sample_email import EmailRuleSavedSampleEmail





T = TypeVar("T", bound="EmailRuleTestSampleInput")



@_attrs_define
class EmailRuleTestSampleInput:
    """ 
        Attributes:
            expected (EmailRuleTestSampleInputExpected):
            email (EmailRuleSavedSampleEmail): A made-up email, as POST /email-rules/test-sample takes it.
            label (None | str | Unset): What the email stands for, such as a personal medical bill.
            id (UUID | Unset):
            created_at (str | Unset):
            group (EmailRuleTestSampleInputGroup | Unset): Its look-alike group: counted by group in the answer.
     """

    expected: EmailRuleTestSampleInputExpected
    email: EmailRuleSavedSampleEmail
    label: None | str | Unset = UNSET
    id: UUID | Unset = UNSET
    created_at: str | Unset = UNSET
    group: EmailRuleTestSampleInputGroup | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_saved_sample_email import EmailRuleSavedSampleEmail # noqa: PLC0415
        expected = self.expected.value

        email = self.email.to_dict()

        label: None | str | Unset
        if isinstance(self.label, Unset):
            label = UNSET
        else:
            label = self.label

        id: str | Unset = UNSET
        if not isinstance(self.id, Unset):
            id = str(self.id)

        created_at = self.created_at

        group: str | Unset = UNSET
        if not isinstance(self.group, Unset):
            group = self.group.value



        field_dict: dict[str, Any] = {}

        field_dict.update({
            "expected": expected,
            "email": email,
        })
        if label is not UNSET:
            field_dict["label"] = label
        if id is not UNSET:
            field_dict["id"] = id
        if created_at is not UNSET:
            field_dict["created_at"] = created_at
        if group is not UNSET:
            field_dict["group"] = group

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_saved_sample_email import EmailRuleSavedSampleEmail # noqa: PLC0415
        d = dict(src_dict)
        expected = EmailRuleTestSampleInputExpected(d.pop("expected"))




        email = EmailRuleSavedSampleEmail.from_dict(d.pop("email"))




        def _parse_label(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        label = _parse_label(d.pop("label", UNSET))


        _id = d.pop("id", UNSET)
        id: UUID | Unset
        if isinstance(_id,  Unset):
            id = UNSET
        else:
            id = UUID(_id)




        created_at = d.pop("created_at", UNSET)

        _group = d.pop("group", UNSET)
        group: EmailRuleTestSampleInputGroup | Unset
        if isinstance(_group,  Unset):
            group = UNSET
        else:
            group = EmailRuleTestSampleInputGroup(_group)




        email_rule_test_sample_input = cls(
            expected=expected,
            email=email,
            label=label,
            id=id,
            created_at=created_at,
            group=group,
        )

        return email_rule_test_sample_input

