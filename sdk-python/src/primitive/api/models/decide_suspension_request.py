from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.decide_suspension_request_decision import DecideSuspensionRequestDecision
from ..models.decide_suspension_request_grant_type_0 import DecideSuspensionRequestGrantType0
from typing import cast

if TYPE_CHECKING:
  from ..models.decide_suspension_request_grant_type_1 import DecideSuspensionRequestGrantType1





T = TypeVar("T", bound="DecideSuspensionRequest")



@_attrs_define
class DecideSuspensionRequest:
    """ 
        Attributes:
            decision (DecideSuspensionRequestDecision):
            grant (DecideSuspensionRequestGrantType0 | DecideSuspensionRequestGrantType1 | Unset):
            confirm (bool | Unset):
            rotate (bool | Unset):
     """

    decision: DecideSuspensionRequestDecision
    grant: DecideSuspensionRequestGrantType0 | DecideSuspensionRequestGrantType1 | Unset = UNSET
    confirm: bool | Unset = UNSET
    rotate: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.decide_suspension_request_grant_type_1 import DecideSuspensionRequestGrantType1 # noqa: PLC0415
        decision = self.decision.value

        grant: dict[str, Any] | str | Unset
        if isinstance(self.grant, Unset):
            grant = UNSET
        elif isinstance(self.grant, DecideSuspensionRequestGrantType0):
            grant = self.grant.value
        else:
            grant = self.grant.to_dict()


        confirm = self.confirm

        rotate = self.rotate


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "decision": decision,
        })
        if grant is not UNSET:
            field_dict["grant"] = grant
        if confirm is not UNSET:
            field_dict["confirm"] = confirm
        if rotate is not UNSET:
            field_dict["rotate"] = rotate

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.decide_suspension_request_grant_type_1 import DecideSuspensionRequestGrantType1 # noqa: PLC0415
        d = dict(src_dict)
        decision = DecideSuspensionRequestDecision(d.pop("decision"))




        def _parse_grant(data: object) -> DecideSuspensionRequestGrantType0 | DecideSuspensionRequestGrantType1 | Unset:
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                grant_type_0 = DecideSuspensionRequestGrantType0(data)



                return grant_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            grant_type_1 = DecideSuspensionRequestGrantType1.from_dict(data)



            return grant_type_1

        grant = _parse_grant(d.pop("grant", UNSET))


        confirm = d.pop("confirm", UNSET)

        rotate = d.pop("rotate", UNSET)

        decide_suspension_request = cls(
            decision=decision,
            grant=grant,
            confirm=confirm,
            rotate=rotate,
        )

        return decide_suspension_request

