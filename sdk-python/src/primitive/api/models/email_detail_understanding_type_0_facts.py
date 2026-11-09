from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_detail_understanding_type_0_facts_additional_property import EmailDetailUnderstandingType0FactsAdditionalProperty





T = TypeVar("T", bound="EmailDetailUnderstandingType0Facts")



@_attrs_define
class EmailDetailUnderstandingType0Facts:
    """ Facts by name, when `ready`. A fact the classification did not produce is absent.

     """

    additional_properties: dict[str, EmailDetailUnderstandingType0FactsAdditionalProperty] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_detail_understanding_type_0_facts_additional_property import EmailDetailUnderstandingType0FactsAdditionalProperty # noqa: PLC0415
        
        field_dict: dict[str, Any] = {}
        for prop_name, prop in self.additional_properties.items():
            field_dict[prop_name] = prop.to_dict()


        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_detail_understanding_type_0_facts_additional_property import EmailDetailUnderstandingType0FactsAdditionalProperty # noqa: PLC0415
        d = dict(src_dict)
        email_detail_understanding_type_0_facts = cls(
        )


        additional_properties = {}
        for prop_name, prop_dict in d.items():
            additional_property = EmailDetailUnderstandingType0FactsAdditionalProperty.from_dict(prop_dict)



            additional_properties[prop_name] = additional_property

        email_detail_understanding_type_0_facts.additional_properties = additional_properties
        return email_detail_understanding_type_0_facts

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> EmailDetailUnderstandingType0FactsAdditionalProperty:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: EmailDetailUnderstandingType0FactsAdditionalProperty) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
