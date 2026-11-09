from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.list_mailbox_access_result_entries_item_actions_item import ListMailboxAccessResultEntriesItemActionsItem
from ..models.list_mailbox_access_result_entries_item_depth import ListMailboxAccessResultEntriesItemDepth
from ..models.list_mailbox_access_result_entries_item_mailbox_kind_type_1 import ListMailboxAccessResultEntriesItemMailboxKindType1
from ..models.list_mailbox_access_result_entries_item_mailbox_kind_type_2_type_1 import ListMailboxAccessResultEntriesItemMailboxKindType2Type1
from ..models.list_mailbox_access_result_entries_item_mailbox_kind_type_3_type_1 import ListMailboxAccessResultEntriesItemMailboxKindType3Type1
from ..models.list_mailbox_access_result_entries_item_principal_kind import ListMailboxAccessResultEntriesItemPrincipalKind
from typing import cast






T = TypeVar("T", bound="ListMailboxAccessResultEntriesItem")



@_attrs_define
class ListMailboxAccessResultEntriesItem:
    """ 
        Attributes:
            id (str):
            mailbox_address (None | str):
            mailbox_domain (None | str):
            mailbox_kind (ListMailboxAccessResultEntriesItemMailboxKindType1 |
                ListMailboxAccessResultEntriesItemMailboxKindType2Type1 |
                ListMailboxAccessResultEntriesItemMailboxKindType3Type1 | None):
            principal_kind (ListMailboxAccessResultEntriesItemPrincipalKind):
            principal_user_id (None | str):
            principal_group_id (None | str):
            principal_agent_connection_id (None | str):
            principal_address (None | str):
            actions (list[ListMailboxAccessResultEntriesItemActionsItem]):
            depth (ListMailboxAccessResultEntriesItemDepth):
            created_at (str):
            updated_at (str):
     """

    id: str
    mailbox_address: None | str
    mailbox_domain: None | str
    mailbox_kind: ListMailboxAccessResultEntriesItemMailboxKindType1 | ListMailboxAccessResultEntriesItemMailboxKindType2Type1 | ListMailboxAccessResultEntriesItemMailboxKindType3Type1 | None
    principal_kind: ListMailboxAccessResultEntriesItemPrincipalKind
    principal_user_id: None | str
    principal_group_id: None | str
    principal_agent_connection_id: None | str
    principal_address: None | str
    actions: list[ListMailboxAccessResultEntriesItemActionsItem]
    depth: ListMailboxAccessResultEntriesItemDepth
    created_at: str
    updated_at: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = self.id

        mailbox_address: None | str
        mailbox_address = self.mailbox_address

        mailbox_domain: None | str
        mailbox_domain = self.mailbox_domain

        mailbox_kind: None | str
        if isinstance(self.mailbox_kind, ListMailboxAccessResultEntriesItemMailboxKindType1):
            mailbox_kind = self.mailbox_kind.value
        elif isinstance(self.mailbox_kind, ListMailboxAccessResultEntriesItemMailboxKindType2Type1):
            mailbox_kind = self.mailbox_kind.value
        elif isinstance(self.mailbox_kind, ListMailboxAccessResultEntriesItemMailboxKindType3Type1):
            mailbox_kind = self.mailbox_kind.value
        else:
            mailbox_kind = self.mailbox_kind

        principal_kind = self.principal_kind.value

        principal_user_id: None | str
        principal_user_id = self.principal_user_id

        principal_group_id: None | str
        principal_group_id = self.principal_group_id

        principal_agent_connection_id: None | str
        principal_agent_connection_id = self.principal_agent_connection_id

        principal_address: None | str
        principal_address = self.principal_address

        actions = []
        for actions_item_data in self.actions:
            actions_item = actions_item_data.value
            actions.append(actions_item)



        depth = self.depth.value

        created_at = self.created_at

        updated_at = self.updated_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "mailbox_address": mailbox_address,
            "mailbox_domain": mailbox_domain,
            "mailbox_kind": mailbox_kind,
            "principal_kind": principal_kind,
            "principal_user_id": principal_user_id,
            "principal_group_id": principal_group_id,
            "principal_agent_connection_id": principal_agent_connection_id,
            "principal_address": principal_address,
            "actions": actions,
            "depth": depth,
            "created_at": created_at,
            "updated_at": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        def _parse_mailbox_address(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        mailbox_address = _parse_mailbox_address(d.pop("mailbox_address"))


        def _parse_mailbox_domain(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        mailbox_domain = _parse_mailbox_domain(d.pop("mailbox_domain"))


        def _parse_mailbox_kind(data: object) -> ListMailboxAccessResultEntriesItemMailboxKindType1 | ListMailboxAccessResultEntriesItemMailboxKindType2Type1 | ListMailboxAccessResultEntriesItemMailboxKindType3Type1 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                mailbox_kind_type_1 = ListMailboxAccessResultEntriesItemMailboxKindType1(data)



                return mailbox_kind_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                mailbox_kind_type_2_type_1 = ListMailboxAccessResultEntriesItemMailboxKindType2Type1(data)



                return mailbox_kind_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                mailbox_kind_type_3_type_1 = ListMailboxAccessResultEntriesItemMailboxKindType3Type1(data)



                return mailbox_kind_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ListMailboxAccessResultEntriesItemMailboxKindType1 | ListMailboxAccessResultEntriesItemMailboxKindType2Type1 | ListMailboxAccessResultEntriesItemMailboxKindType3Type1 | None, data)

        mailbox_kind = _parse_mailbox_kind(d.pop("mailbox_kind"))


        principal_kind = ListMailboxAccessResultEntriesItemPrincipalKind(d.pop("principal_kind"))




        def _parse_principal_user_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        principal_user_id = _parse_principal_user_id(d.pop("principal_user_id"))


        def _parse_principal_group_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        principal_group_id = _parse_principal_group_id(d.pop("principal_group_id"))


        def _parse_principal_agent_connection_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        principal_agent_connection_id = _parse_principal_agent_connection_id(d.pop("principal_agent_connection_id"))


        def _parse_principal_address(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        principal_address = _parse_principal_address(d.pop("principal_address"))


        actions = []
        _actions = d.pop("actions")
        for actions_item_data in (_actions):
            actions_item = ListMailboxAccessResultEntriesItemActionsItem(actions_item_data)



            actions.append(actions_item)


        depth = ListMailboxAccessResultEntriesItemDepth(d.pop("depth"))




        created_at = d.pop("created_at")

        updated_at = d.pop("updated_at")

        list_mailbox_access_result_entries_item = cls(
            id=id,
            mailbox_address=mailbox_address,
            mailbox_domain=mailbox_domain,
            mailbox_kind=mailbox_kind,
            principal_kind=principal_kind,
            principal_user_id=principal_user_id,
            principal_group_id=principal_group_id,
            principal_agent_connection_id=principal_agent_connection_id,
            principal_address=principal_address,
            actions=actions,
            depth=depth,
            created_at=created_at,
            updated_at=updated_at,
        )


        list_mailbox_access_result_entries_item.additional_properties = d
        return list_mailbox_access_result_entries_item

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
