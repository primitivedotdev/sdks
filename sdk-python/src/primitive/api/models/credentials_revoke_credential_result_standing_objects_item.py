from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="CredentialsRevokeCredentialResultStandingObjectsItem")



@_attrs_define
class CredentialsRevokeCredentialResultStandingObjectsItem:
    """ 
        Attributes:
            kind (str): endpoint, function_trigger, pull_subscription, recipient_route, filter_rule or wake_schedule.
            id (str):
            label (str): A webhook's URL, a pull subscription's name (or pull when it has none), a route's or filter's
                pattern, or a wake schedule's command and the address it wakes (command to address). A Function trigger's label
                is function: look it up by id.
            org_owned (bool): true: the organization owns it, and it keeps working. false: the credential owns it itself, as
                with everything a third-party app or agent delegate made, a webhook made with a narrowed API key, or a wake
                schedule made with a key that does not cover super_admin. It keeps working only while someone can still act for
                it, such as a key of the same rotation that still works, or whoever it was given to or kept it. Revoking a
                third-party app or agent delegate turns these off, except that a block filter it made keeps blocking, within the
                reach the app had, unless the person revoking chose to stop it.
     """

    kind: str
    id: str
    label: str
    org_owned: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        id = self.id

        label = self.label

        org_owned = self.org_owned


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
            "id": id,
            "label": label,
            "org_owned": org_owned,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = d.pop("kind")

        id = d.pop("id")

        label = d.pop("label")

        org_owned = d.pop("org_owned")

        credentials_revoke_credential_result_standing_objects_item = cls(
            kind=kind,
            id=id,
            label=label,
            org_owned=org_owned,
        )


        credentials_revoke_credential_result_standing_objects_item.additional_properties = d
        return credentials_revoke_credential_result_standing_objects_item

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
