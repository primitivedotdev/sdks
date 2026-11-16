from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="ListSentEmailsResponse200Meta")



@_attrs_define
class ListSentEmailsResponse200Meta:
    """ 
        Attributes:
            domain_ids (list[UUID] | Unset): Present when the request filtered by `domain_ids`: the ids it was given,
                deduped and lowercased.
     """

    domain_ids: list[UUID] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        domain_ids: list[str] | Unset = UNSET
        if not isinstance(self.domain_ids, Unset):
            domain_ids = []
            for domain_ids_item_data in self.domain_ids:
                domain_ids_item = str(domain_ids_item_data)
                domain_ids.append(domain_ids_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if domain_ids is not UNSET:
            field_dict["domain_ids"] = domain_ids

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        _domain_ids = d.pop("domain_ids", UNSET)
        domain_ids: list[UUID] | Unset = UNSET
        if _domain_ids is not UNSET:
            domain_ids = []
            for domain_ids_item_data in _domain_ids:
                domain_ids_item = UUID(domain_ids_item_data)



                domain_ids.append(domain_ids_item)


        list_sent_emails_response_200_meta = cls(
            domain_ids=domain_ids,
        )


        list_sent_emails_response_200_meta.additional_properties = d
        return list_sent_emails_response_200_meta

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
