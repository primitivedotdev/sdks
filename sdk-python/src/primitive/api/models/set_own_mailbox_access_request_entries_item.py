from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.set_own_mailbox_access_request_entries_item_actions_item import SetOwnMailboxAccessRequestEntriesItemActionsItem
from ..models.set_own_mailbox_access_request_entries_item_depth import SetOwnMailboxAccessRequestEntriesItemDepth
from typing import cast

if TYPE_CHECKING:
  from ..models.set_own_mailbox_access_request_entries_item_principal import SetOwnMailboxAccessRequestEntriesItemPrincipal





T = TypeVar("T", bound="SetOwnMailboxAccessRequestEntriesItem")



@_attrs_define
class SetOwnMailboxAccessRequestEntriesItem:
    """ 
        Attributes:
            principal (SetOwnMailboxAccessRequestEntriesItemPrincipal):
            actions (list[SetOwnMailboxAccessRequestEntriesItemActionsItem]):
            depth (SetOwnMailboxAccessRequestEntriesItemDepth | Unset): Deprecated and ignored: every scope that reaches
                mail reads the full email, and raw MIME follows mail.raw:read. New entries record content. Default:
                SetOwnMailboxAccessRequestEntriesItemDepth.CONTENT.
     """

    principal: SetOwnMailboxAccessRequestEntriesItemPrincipal
    actions: list[SetOwnMailboxAccessRequestEntriesItemActionsItem]
    depth: SetOwnMailboxAccessRequestEntriesItemDepth | Unset = SetOwnMailboxAccessRequestEntriesItemDepth.CONTENT





    def to_dict(self) -> dict[str, Any]:
        from ..models.set_own_mailbox_access_request_entries_item_principal import SetOwnMailboxAccessRequestEntriesItemPrincipal # noqa: PLC0415
        principal = self.principal.to_dict()

        actions = []
        for actions_item_data in self.actions:
            actions_item = actions_item_data.value
            actions.append(actions_item)



        depth: str | Unset = UNSET
        if not isinstance(self.depth, Unset):
            depth = self.depth.value



        field_dict: dict[str, Any] = {}

        field_dict.update({
            "principal": principal,
            "actions": actions,
        })
        if depth is not UNSET:
            field_dict["depth"] = depth

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.set_own_mailbox_access_request_entries_item_principal import SetOwnMailboxAccessRequestEntriesItemPrincipal # noqa: PLC0415
        d = dict(src_dict)
        principal = SetOwnMailboxAccessRequestEntriesItemPrincipal.from_dict(d.pop("principal"))




        actions = []
        _actions = d.pop("actions")
        for actions_item_data in (_actions):
            actions_item = SetOwnMailboxAccessRequestEntriesItemActionsItem(actions_item_data)



            actions.append(actions_item)


        _depth = d.pop("depth", UNSET)
        depth: SetOwnMailboxAccessRequestEntriesItemDepth | Unset
        if isinstance(_depth,  Unset):
            depth = UNSET
        else:
            depth = SetOwnMailboxAccessRequestEntriesItemDepth(_depth)




        set_own_mailbox_access_request_entries_item = cls(
            principal=principal,
            actions=actions,
            depth=depth,
        )

        return set_own_mailbox_access_request_entries_item

