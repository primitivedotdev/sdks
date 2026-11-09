from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.credentials_revoke_all_credentials_input_confirm import CredentialsRevokeAllCredentialsInputConfirm
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="CredentialsRevokeAllCredentialsInput")



@_attrs_define
class CredentialsRevokeAllCredentialsInput:
    """ 
        Attributes:
            since (datetime.datetime):
            confirm (CredentialsRevokeAllCredentialsInputConfirm):
            suspend_function_ids (list[UUID] | Unset):
     """

    since: datetime.datetime
    confirm: CredentialsRevokeAllCredentialsInputConfirm
    suspend_function_ids: list[UUID] | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        since = self.since.isoformat()

        confirm = self.confirm.value

        suspend_function_ids: list[str] | Unset = UNSET
        if not isinstance(self.suspend_function_ids, Unset):
            suspend_function_ids = []
            for suspend_function_ids_item_data in self.suspend_function_ids:
                suspend_function_ids_item = str(suspend_function_ids_item_data)
                suspend_function_ids.append(suspend_function_ids_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "since": since,
            "confirm": confirm,
        })
        if suspend_function_ids is not UNSET:
            field_dict["suspend_function_ids"] = suspend_function_ids

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        since = datetime.datetime.fromisoformat(d.pop("since"))




        confirm = CredentialsRevokeAllCredentialsInputConfirm(d.pop("confirm"))




        _suspend_function_ids = d.pop("suspend_function_ids", UNSET)
        suspend_function_ids: list[UUID] | Unset = UNSET
        if _suspend_function_ids is not UNSET:
            suspend_function_ids = []
            for suspend_function_ids_item_data in _suspend_function_ids:
                suspend_function_ids_item = UUID(suspend_function_ids_item_data)



                suspend_function_ids.append(suspend_function_ids_item)


        credentials_revoke_all_credentials_input = cls(
            since=since,
            confirm=confirm,
            suspend_function_ids=suspend_function_ids,
        )

        return credentials_revoke_all_credentials_input

