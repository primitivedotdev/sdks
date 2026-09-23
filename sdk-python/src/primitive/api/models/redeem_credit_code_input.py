from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="RedeemCreditCodeInput")



@_attrs_define
class RedeemCreditCodeInput:
    """ 
        Attributes:
            code (str): The credit code to redeem. Surrounding whitespace is ignored.
     """

    code: str





    def to_dict(self) -> dict[str, Any]:
        code = self.code


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "code": code,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        code = d.pop("code")

        redeem_credit_code_input = cls(
            code=code,
        )

        return redeem_credit_code_input

