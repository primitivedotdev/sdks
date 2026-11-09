from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="DkimSignature")



@_attrs_define
class DkimSignature:
    """ One DKIM signature found on the message, with its verdict. Any field may be absent or null on mail stored before
    that field was recorded.

        Attributes:
            domain (None | str | Unset):
            selector (None | str | Unset):
            result (None | str | Unset): Verification result (e.g. `pass`, `fail`, `none`).
            aligned (bool | None | Unset): Whether the signing domain aligns with the From domain (for DMARC).
            key_bits (int | None | Unset):
            algo (None | str | Unset):
     """

    domain: None | str | Unset = UNSET
    selector: None | str | Unset = UNSET
    result: None | str | Unset = UNSET
    aligned: bool | None | Unset = UNSET
    key_bits: int | None | Unset = UNSET
    algo: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        domain: None | str | Unset
        if isinstance(self.domain, Unset):
            domain = UNSET
        else:
            domain = self.domain

        selector: None | str | Unset
        if isinstance(self.selector, Unset):
            selector = UNSET
        else:
            selector = self.selector

        result: None | str | Unset
        if isinstance(self.result, Unset):
            result = UNSET
        else:
            result = self.result

        aligned: bool | None | Unset
        if isinstance(self.aligned, Unset):
            aligned = UNSET
        else:
            aligned = self.aligned

        key_bits: int | None | Unset
        if isinstance(self.key_bits, Unset):
            key_bits = UNSET
        else:
            key_bits = self.key_bits

        algo: None | str | Unset
        if isinstance(self.algo, Unset):
            algo = UNSET
        else:
            algo = self.algo


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if domain is not UNSET:
            field_dict["domain"] = domain
        if selector is not UNSET:
            field_dict["selector"] = selector
        if result is not UNSET:
            field_dict["result"] = result
        if aligned is not UNSET:
            field_dict["aligned"] = aligned
        if key_bits is not UNSET:
            field_dict["keyBits"] = key_bits
        if algo is not UNSET:
            field_dict["algo"] = algo

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_domain(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        domain = _parse_domain(d.pop("domain", UNSET))


        def _parse_selector(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        selector = _parse_selector(d.pop("selector", UNSET))


        def _parse_result(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        result = _parse_result(d.pop("result", UNSET))


        def _parse_aligned(data: object) -> bool | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(bool | None | Unset, data)

        aligned = _parse_aligned(d.pop("aligned", UNSET))


        def _parse_key_bits(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        key_bits = _parse_key_bits(d.pop("keyBits", UNSET))


        def _parse_algo(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        algo = _parse_algo(d.pop("algo", UNSET))


        dkim_signature = cls(
            domain=domain,
            selector=selector,
            result=result,
            aligned=aligned,
            key_bits=key_bits,
            algo=algo,
        )


        dkim_signature.additional_properties = d
        return dkim_signature

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
