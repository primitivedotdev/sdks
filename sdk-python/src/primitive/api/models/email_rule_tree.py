from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_tree_when import EmailRuleTreeWhen





T = TypeVar("T", bound="EmailRuleTree")



@_attrs_define
class EmailRuleTree:
    """ A compiled rule. The server checks it against the column contract on save.

        Attributes:
            version (int): Tree format version.
            vocabulary (str): Column contract version, for example `v1`.
            when (EmailRuleTreeWhen): The rule's conditions, as a condition or an `all`, `any` or `not` group.
            questions (list[str]): Yes/no questions asked after the conditions match. Every answer must be yes.
     """

    version: int
    vocabulary: str
    when: EmailRuleTreeWhen
    questions: list[str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_tree_when import EmailRuleTreeWhen # noqa: PLC0415
        version = self.version

        vocabulary = self.vocabulary

        when = self.when.to_dict()

        questions = self.questions




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "version": version,
            "vocabulary": vocabulary,
            "when": when,
            "questions": questions,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_tree_when import EmailRuleTreeWhen # noqa: PLC0415
        d = dict(src_dict)
        version = d.pop("version")

        vocabulary = d.pop("vocabulary")

        when = EmailRuleTreeWhen.from_dict(d.pop("when"))




        questions = cast(list[str], d.pop("questions"))


        email_rule_tree = cls(
            version=version,
            vocabulary=vocabulary,
            when=when,
            questions=questions,
        )


        email_rule_tree.additional_properties = d
        return email_rule_tree

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
