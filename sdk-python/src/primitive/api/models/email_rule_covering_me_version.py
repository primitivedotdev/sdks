from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.email_rule_tree import EmailRuleTree





T = TypeVar("T", bound="EmailRuleCoveringMeVersion")



@_attrs_define
class EmailRuleCoveringMeVersion:
    """ 
        Attributes:
            version (int):
            english (str): What its author asked for, in their words.
            tree (EmailRuleTree):
            explanation (None | str): What the rule matches: Primitive's reading of the tree, worked out on every read,
                never the words of whoever wrote the rule. Null when the tree no longer reads as one.
            warnings (list[str]): Primitive's notes on the tree and its english, worked out on every read.
            vocabulary (str):
            created_at (datetime.datetime):
     """

    version: int
    english: str
    tree: EmailRuleTree
    explanation: None | str
    warnings: list[str]
    vocabulary: str
    created_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_tree import EmailRuleTree # noqa: PLC0415
        version = self.version

        english = self.english

        tree = self.tree.to_dict()

        explanation: None | str
        explanation = self.explanation

        warnings = self.warnings



        vocabulary = self.vocabulary

        created_at = self.created_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "version": version,
            "english": english,
            "tree": tree,
            "explanation": explanation,
            "warnings": warnings,
            "vocabulary": vocabulary,
            "created_at": created_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_tree import EmailRuleTree # noqa: PLC0415
        d = dict(src_dict)
        version = d.pop("version")

        english = d.pop("english")

        tree = EmailRuleTree.from_dict(d.pop("tree"))




        def _parse_explanation(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        explanation = _parse_explanation(d.pop("explanation"))


        warnings = cast(list[str], d.pop("warnings"))


        vocabulary = d.pop("vocabulary")

        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        email_rule_covering_me_version = cls(
            version=version,
            english=english,
            tree=tree,
            explanation=explanation,
            warnings=warnings,
            vocabulary=vocabulary,
            created_at=created_at,
        )


        email_rule_covering_me_version.additional_properties = d
        return email_rule_covering_me_version

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
