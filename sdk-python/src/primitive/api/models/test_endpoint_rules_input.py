from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="TestEndpointRulesInput")



@_attrs_define
class TestEndpointRulesInput:
    """ 
        Attributes:
            email_id (UUID): Id of an already-received email (in your org) to evaluate the rules against.
     """

    email_id: UUID





    def to_dict(self) -> dict[str, Any]:
        email_id = str(self.email_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "email_id": email_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        email_id = UUID(d.pop("email_id"))




        test_endpoint_rules_input = cls(
            email_id=email_id,
        )

        return test_endpoint_rules_input

