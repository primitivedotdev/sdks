from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.list_email_rule_results_result_classification_type_0_facts import ListEmailRuleResultsResultClassificationType0Facts





T = TypeVar("T", bound="ListEmailRuleResultsResultClassificationType0")



@_attrs_define
class ListEmailRuleResultsResultClassificationType0:
    """ What the classifier read from this email (one classification per vocabulary); null when it has none (not classified,
    or never will be), or while the email's content is withheld, discarded or failed to parse.

        Attributes:
            id (UUID):
            vocabulary (str):
            classified_at (datetime.datetime):
            facts (ListEmailRuleResultsResultClassificationType0Facts): Every fact column, as rule conditions read it: the
                value (a multi's options lowercased; null if the classifier left it out or wrote another shape) and its
                confidence. It can differ from GET /emails/{id} understanding, which shows the facts as written.
     """

    id: UUID
    vocabulary: str
    classified_at: datetime.datetime
    facts: ListEmailRuleResultsResultClassificationType0Facts
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_email_rule_results_result_classification_type_0_facts import ListEmailRuleResultsResultClassificationType0Facts # noqa: PLC0415
        id = str(self.id)

        vocabulary = self.vocabulary

        classified_at = self.classified_at.isoformat()

        facts = self.facts.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "vocabulary": vocabulary,
            "classified_at": classified_at,
            "facts": facts,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_email_rule_results_result_classification_type_0_facts import ListEmailRuleResultsResultClassificationType0Facts # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        vocabulary = d.pop("vocabulary")

        classified_at = datetime.datetime.fromisoformat(d.pop("classified_at"))




        facts = ListEmailRuleResultsResultClassificationType0Facts.from_dict(d.pop("facts"))




        list_email_rule_results_result_classification_type_0 = cls(
            id=id,
            vocabulary=vocabulary,
            classified_at=classified_at,
            facts=facts,
        )


        list_email_rule_results_result_classification_type_0.additional_properties = d
        return list_email_rule_results_result_classification_type_0

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
