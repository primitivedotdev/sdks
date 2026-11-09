from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.decide_access_mode_request_decisions_item import DecideAccessModeRequestDecisionsItem





T = TypeVar("T", bound="DecideAccessModeRequest")



@_attrs_define
class DecideAccessModeRequest:
    """ 
        Attributes:
            decisions (list[DecideAccessModeRequestDecisionsItem]):
     """

    decisions: list[DecideAccessModeRequestDecisionsItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.decide_access_mode_request_decisions_item import DecideAccessModeRequestDecisionsItem # noqa: PLC0415
        decisions = []
        for decisions_item_data in self.decisions:
            decisions_item = decisions_item_data.to_dict()
            decisions.append(decisions_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "decisions": decisions,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.decide_access_mode_request_decisions_item import DecideAccessModeRequestDecisionsItem # noqa: PLC0415
        d = dict(src_dict)
        decisions = []
        _decisions = d.pop("decisions")
        for decisions_item_data in (_decisions):
            decisions_item = DecideAccessModeRequestDecisionsItem.from_dict(decisions_item_data)



            decisions.append(decisions_item)


        decide_access_mode_request = cls(
            decisions=decisions,
        )

        return decide_access_mode_request

