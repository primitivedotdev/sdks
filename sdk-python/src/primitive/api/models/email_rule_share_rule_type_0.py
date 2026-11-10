from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_rule_share_rule_type_0_state import EmailRuleShareRuleType0State
from typing import cast
import datetime






T = TypeVar("T", bound="EmailRuleShareRuleType0")



@_attrs_define
class EmailRuleShareRuleType0:
    """ The rule's name, state and description; null once the share is not live, except for the member sharing their mail.

        Attributes:
            name (str):
            state (EmailRuleShareRuleType0State):
            current_version (int | None):
            english (None | str):
            explanation (None | str):
            updated_at (datetime.datetime):
     """

    name: str
    state: EmailRuleShareRuleType0State
    current_version: int | None
    english: None | str
    explanation: None | str
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        state = self.state.value

        current_version: int | None
        current_version = self.current_version

        english: None | str
        english = self.english

        explanation: None | str
        explanation = self.explanation

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
            "state": state,
            "current_version": current_version,
            "english": english,
            "explanation": explanation,
            "updated_at": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        state = EmailRuleShareRuleType0State(d.pop("state"))




        def _parse_current_version(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        current_version = _parse_current_version(d.pop("current_version"))


        def _parse_english(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        english = _parse_english(d.pop("english"))


        def _parse_explanation(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        explanation = _parse_explanation(d.pop("explanation"))


        updated_at = datetime.datetime.fromisoformat(d.pop("updated_at"))




        email_rule_share_rule_type_0 = cls(
            name=name,
            state=state,
            current_version=current_version,
            english=english,
            explanation=explanation,
            updated_at=updated_at,
        )


        email_rule_share_rule_type_0.additional_properties = d
        return email_rule_share_rule_type_0

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
