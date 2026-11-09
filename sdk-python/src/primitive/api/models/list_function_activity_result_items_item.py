from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.list_function_activity_result_items_item_type import ListFunctionActivityResultItemsItemType
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="ListFunctionActivityResultItemsItem")



@_attrs_define
class ListFunctionActivityResultItemsItem:
    """ 
        Attributes:
            id (UUID):
            function_id (UUID):
            type_ (ListFunctionActivityResultItemsItemType):
            occurred_at (datetime.datetime):
            status (str):
            delivery_id (None | str):
            email_id (None | UUID):
            sent_email_id (None | UUID):
            related_email_id (None | UUID):
     """

    id: UUID
    function_id: UUID
    type_: ListFunctionActivityResultItemsItemType
    occurred_at: datetime.datetime
    status: str
    delivery_id: None | str
    email_id: None | UUID
    sent_email_id: None | UUID
    related_email_id: None | UUID
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        function_id = str(self.function_id)

        type_ = self.type_.value

        occurred_at = self.occurred_at.isoformat()

        status = self.status

        delivery_id: None | str
        delivery_id = self.delivery_id

        email_id: None | str
        if isinstance(self.email_id, UUID):
            email_id = str(self.email_id)
        else:
            email_id = self.email_id

        sent_email_id: None | str
        if isinstance(self.sent_email_id, UUID):
            sent_email_id = str(self.sent_email_id)
        else:
            sent_email_id = self.sent_email_id

        related_email_id: None | str
        if isinstance(self.related_email_id, UUID):
            related_email_id = str(self.related_email_id)
        else:
            related_email_id = self.related_email_id


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "function_id": function_id,
            "type": type_,
            "occurred_at": occurred_at,
            "status": status,
            "delivery_id": delivery_id,
            "email_id": email_id,
            "sent_email_id": sent_email_id,
            "related_email_id": related_email_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        function_id = UUID(d.pop("function_id"))




        type_ = ListFunctionActivityResultItemsItemType(d.pop("type"))




        occurred_at = datetime.datetime.fromisoformat(d.pop("occurred_at"))




        status = d.pop("status")

        def _parse_delivery_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        delivery_id = _parse_delivery_id(d.pop("delivery_id"))


        def _parse_email_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                email_id_type_0 = UUID(data)



                return email_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        email_id = _parse_email_id(d.pop("email_id"))


        def _parse_sent_email_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                sent_email_id_type_0 = UUID(data)



                return sent_email_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        sent_email_id = _parse_sent_email_id(d.pop("sent_email_id"))


        def _parse_related_email_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                related_email_id_type_0 = UUID(data)



                return related_email_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        related_email_id = _parse_related_email_id(d.pop("related_email_id"))


        list_function_activity_result_items_item = cls(
            id=id,
            function_id=function_id,
            type_=type_,
            occurred_at=occurred_at,
            status=status,
            delivery_id=delivery_id,
            email_id=email_id,
            sent_email_id=sent_email_id,
            related_email_id=related_email_id,
        )


        list_function_activity_result_items_item.additional_properties = d
        return list_function_activity_result_items_item

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
