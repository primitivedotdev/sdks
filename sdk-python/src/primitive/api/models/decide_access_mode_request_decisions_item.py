from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.decide_access_mode_request_decisions_item_decision import DecideAccessModeRequestDecisionsItemDecision
from ..models.decide_access_mode_request_decisions_item_kind import DecideAccessModeRequestDecisionsItemKind






T = TypeVar("T", bound="DecideAccessModeRequestDecisionsItem")



@_attrs_define
class DecideAccessModeRequestDecisionsItem:
    """ 
        Attributes:
            kind (DecideAccessModeRequestDecisionsItemKind):
            id (str):
            decision (DecideAccessModeRequestDecisionsItemDecision):
            note (str | Unset):
            confirm (bool | Unset):
     """

    kind: DecideAccessModeRequestDecisionsItemKind
    id: str
    decision: DecideAccessModeRequestDecisionsItemDecision
    note: str | Unset = UNSET
    confirm: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        id = self.id

        decision = self.decision.value

        note = self.note

        confirm = self.confirm


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "id": id,
            "decision": decision,
        })
        if note is not UNSET:
            field_dict["note"] = note
        if confirm is not UNSET:
            field_dict["confirm"] = confirm

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = DecideAccessModeRequestDecisionsItemKind(d.pop("kind"))




        id = d.pop("id")

        decision = DecideAccessModeRequestDecisionsItemDecision(d.pop("decision"))




        note = d.pop("note", UNSET)

        confirm = d.pop("confirm", UNSET)

        decide_access_mode_request_decisions_item = cls(
            kind=kind,
            id=id,
            decision=decision,
            note=note,
            confirm=confirm,
        )

        return decide_access_mode_request_decisions_item

