from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="AccountUpdated")



@_attrs_define
class AccountUpdated:
    """ 
        Attributes:
            id (UUID):
            email (str):
            plan (str):
            discard_content_on_webhook_confirmed (bool):
            spam_threshold (float | None | Unset):
     """

    id: UUID
    email: str
    plan: str
    discard_content_on_webhook_confirmed: bool
    spam_threshold: float | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        email = self.email

        plan = self.plan

        discard_content_on_webhook_confirmed = self.discard_content_on_webhook_confirmed

        spam_threshold: float | None | Unset
        if isinstance(self.spam_threshold, Unset):
            spam_threshold = UNSET
        else:
            spam_threshold = self.spam_threshold


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "email": email,
            "plan": plan,
            "discard_content_on_webhook_confirmed": discard_content_on_webhook_confirmed,
        })
        if spam_threshold is not UNSET:
            field_dict["spam_threshold"] = spam_threshold

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        email = d.pop("email")

        plan = d.pop("plan")

        discard_content_on_webhook_confirmed = d.pop("discard_content_on_webhook_confirmed")

        def _parse_spam_threshold(data: object) -> float | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(float | None | Unset, data)

        spam_threshold = _parse_spam_threshold(d.pop("spam_threshold", UNSET))


        account_updated = cls(
            id=id,
            email=email,
            plan=plan,
            discard_content_on_webhook_confirmed=discard_content_on_webhook_confirmed,
            spam_threshold=spam_threshold,
        )


        account_updated.additional_properties = d
        return account_updated

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
