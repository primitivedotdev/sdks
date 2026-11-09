from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.put_mail_routing_request_placement import PutMailRoutingRequestPlacement
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="PutMailRoutingRequest")



@_attrs_define
class PutMailRoutingRequest:
    """ 
        Attributes:
            mailbox (str):
            participants (list[str]):
            placement (PutMailRoutingRequestPlacement):
            expected_version (int):
            mutation_id (UUID):
     """

    mailbox: str
    participants: list[str]
    placement: PutMailRoutingRequestPlacement
    expected_version: int
    mutation_id: UUID





    def to_dict(self) -> dict[str, Any]:
        mailbox = self.mailbox

        participants = self.participants



        placement = self.placement.value

        expected_version = self.expected_version

        mutation_id = str(self.mutation_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "mailbox": mailbox,
            "participants": participants,
            "placement": placement,
            "expected_version": expected_version,
            "mutation_id": mutation_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        mailbox = d.pop("mailbox")

        participants = cast(list[str], d.pop("participants"))


        placement = PutMailRoutingRequestPlacement(d.pop("placement"))




        expected_version = d.pop("expected_version")

        mutation_id = UUID(d.pop("mutation_id"))




        put_mail_routing_request = cls(
            mailbox=mailbox,
            participants=participants,
            placement=placement,
            expected_version=expected_version,
            mutation_id=mutation_id,
        )

        return put_mail_routing_request

