from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="PullWebhookInput")



@_attrs_define
class PullWebhookInput:
    """ 
        Attributes:
            wait_seconds (int | Unset):  Default: 25.
     """

    wait_seconds: int | Unset = 25





    def to_dict(self) -> dict[str, Any]:
        wait_seconds = self.wait_seconds


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if wait_seconds is not UNSET:
            field_dict["wait_seconds"] = wait_seconds

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        wait_seconds = d.pop("wait_seconds", UNSET)

        pull_webhook_input = cls(
            wait_seconds=wait_seconds,
        )

        return pull_webhook_input

