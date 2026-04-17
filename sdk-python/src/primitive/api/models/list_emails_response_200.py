from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_summary import EmailSummary
  from ..models.pagination_meta import PaginationMeta





T = TypeVar("T", bound="ListEmailsResponse200")



@_attrs_define
class ListEmailsResponse200:
    """ 
        Attributes:
            success (bool):
            meta (PaginationMeta):
            data (list[EmailSummary] | Unset):
     """

    success: bool
    meta: PaginationMeta
    data: list[EmailSummary] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_summary import EmailSummary
        from ..models.pagination_meta import PaginationMeta
        success = self.success

        meta = self.meta.to_dict()

        data: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.data, Unset):
            data = []
            for data_item_data in self.data:
                data_item = data_item_data.to_dict()
                data.append(data_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "success": success,
            "meta": meta,
        })
        if data is not UNSET:
            field_dict["data"] = data

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_summary import EmailSummary
        from ..models.pagination_meta import PaginationMeta
        d = dict(src_dict)
        success = d.pop("success")

        meta = PaginationMeta.from_dict(d.pop("meta"))




        _data = d.pop("data", UNSET)
        data: list[EmailSummary] | Unset = UNSET
        if _data is not UNSET:
            data = []
            for data_item_data in _data:
                data_item = EmailSummary.from_dict(data_item_data)



                data.append(data_item)


        list_emails_response_200 = cls(
            success=success,
            meta=meta,
            data=data,
        )


        list_emails_response_200.additional_properties = d
        return list_emails_response_200

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
