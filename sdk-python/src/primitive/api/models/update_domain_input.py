from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="UpdateDomainInput")



@_attrs_define
class UpdateDomainInput:
    """ 
        Attributes:
            is_active (bool | Unset): Whether the domain accepts incoming emails
            spam_threshold (float | None | Unset): Per-domain spam threshold override (Pro plan required)
     """

    is_active: bool | Unset = UNSET
    spam_threshold: float | None | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        is_active = self.is_active

        spam_threshold: float | None | Unset
        if isinstance(self.spam_threshold, Unset):
            spam_threshold = UNSET
        else:
            spam_threshold = self.spam_threshold


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if is_active is not UNSET:
            field_dict["is_active"] = is_active
        if spam_threshold is not UNSET:
            field_dict["spam_threshold"] = spam_threshold

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        is_active = d.pop("is_active", UNSET)

        def _parse_spam_threshold(data: object) -> float | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(float | None | Unset, data)

        spam_threshold = _parse_spam_threshold(d.pop("spam_threshold", UNSET))


        update_domain_input = cls(
            is_active=is_active,
            spam_threshold=spam_threshold,
        )

        return update_domain_input

