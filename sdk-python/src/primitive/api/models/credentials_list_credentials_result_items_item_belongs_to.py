from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.credentials_list_credentials_result_items_item_belongs_to_function_type_0 import CredentialsListCredentialsResultItemsItemBelongsToFunctionType0
  from ..models.credentials_list_credentials_result_items_item_belongs_to_person_type_0 import CredentialsListCredentialsResultItemsItemBelongsToPersonType0





T = TypeVar("T", bound="CredentialsListCredentialsResultItemsItemBelongsTo")



@_attrs_define
class CredentialsListCredentialsResultItemsItemBelongsTo:
    """ 
        Attributes:
            function (CredentialsListCredentialsResultItemsItemBelongsToFunctionType0 | None):
            agent_address (None | str):
            person (CredentialsListCredentialsResultItemsItemBelongsToPersonType0 | None):
     """

    function: CredentialsListCredentialsResultItemsItemBelongsToFunctionType0 | None
    agent_address: None | str
    person: CredentialsListCredentialsResultItemsItemBelongsToPersonType0 | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.credentials_list_credentials_result_items_item_belongs_to_function_type_0 import CredentialsListCredentialsResultItemsItemBelongsToFunctionType0 # noqa: PLC0415
        from ..models.credentials_list_credentials_result_items_item_belongs_to_person_type_0 import CredentialsListCredentialsResultItemsItemBelongsToPersonType0 # noqa: PLC0415
        function: dict[str, Any] | None
        if isinstance(self.function, CredentialsListCredentialsResultItemsItemBelongsToFunctionType0):
            function = self.function.to_dict()
        else:
            function = self.function

        agent_address: None | str
        agent_address = self.agent_address

        person: dict[str, Any] | None
        if isinstance(self.person, CredentialsListCredentialsResultItemsItemBelongsToPersonType0):
            person = self.person.to_dict()
        else:
            person = self.person


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "function": function,
            "agent_address": agent_address,
            "person": person,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.credentials_list_credentials_result_items_item_belongs_to_function_type_0 import CredentialsListCredentialsResultItemsItemBelongsToFunctionType0 # noqa: PLC0415
        from ..models.credentials_list_credentials_result_items_item_belongs_to_person_type_0 import CredentialsListCredentialsResultItemsItemBelongsToPersonType0 # noqa: PLC0415
        d = dict(src_dict)
        def _parse_function(data: object) -> CredentialsListCredentialsResultItemsItemBelongsToFunctionType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                function_type_0 = CredentialsListCredentialsResultItemsItemBelongsToFunctionType0.from_dict(data)



                return function_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(CredentialsListCredentialsResultItemsItemBelongsToFunctionType0 | None, data)

        function = _parse_function(d.pop("function"))


        def _parse_agent_address(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        agent_address = _parse_agent_address(d.pop("agent_address"))


        def _parse_person(data: object) -> CredentialsListCredentialsResultItemsItemBelongsToPersonType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                person_type_0 = CredentialsListCredentialsResultItemsItemBelongsToPersonType0.from_dict(data)



                return person_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(CredentialsListCredentialsResultItemsItemBelongsToPersonType0 | None, data)

        person = _parse_person(d.pop("person"))


        credentials_list_credentials_result_items_item_belongs_to = cls(
            function=function,
            agent_address=agent_address,
            person=person,
        )


        credentials_list_credentials_result_items_item_belongs_to.additional_properties = d
        return credentials_list_credentials_result_items_item_belongs_to

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
