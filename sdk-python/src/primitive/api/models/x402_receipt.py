from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.x402_receipt_status import X402ReceiptStatus
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="X402Receipt")



@_attrs_define
class X402Receipt:
    """ 
        Attributes:
            id (UUID):
            status (X402ReceiptStatus):
            settle_tx (None | str): On-chain settlement transaction hash.
     """

    id: UUID
    status: X402ReceiptStatus
    settle_tx: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        status = self.status.value

        settle_tx: None | str
        settle_tx = self.settle_tx


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "status": status,
            "settle_tx": settle_tx,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        status = X402ReceiptStatus(d.pop("status"))




        def _parse_settle_tx(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        settle_tx = _parse_settle_tx(d.pop("settle_tx"))


        x402_receipt = cls(
            id=id,
            status=status,
            settle_tx=settle_tx,
        )


        x402_receipt.additional_properties = d
        return x402_receipt

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
