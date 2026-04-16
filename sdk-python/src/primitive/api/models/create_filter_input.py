from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_filter_input_type import CreateFilterInputType
from ..types import UNSET, Unset
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="CreateFilterInput")



@_attrs_define
class CreateFilterInput:
    """ 
        Attributes:
            type_ (CreateFilterInputType):
            pattern (str): Email address or pattern to filter
            domain_id (None | Unset | UUID): Restrict filter to a specific domain (Pro plan required)
     """

    type_: CreateFilterInputType
    pattern: str
    domain_id: None | Unset | UUID = UNSET





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value

        pattern = self.pattern

        domain_id: None | str | Unset
        if isinstance(self.domain_id, Unset):
            domain_id = UNSET
        elif isinstance(self.domain_id, UUID):
            domain_id = str(self.domain_id)
        else:
            domain_id = self.domain_id


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
            "pattern": pattern,
        })
        if domain_id is not UNSET:
            field_dict["domain_id"] = domain_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = CreateFilterInputType(d.pop("type"))




        pattern = d.pop("pattern")

        def _parse_domain_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                domain_id_type_0 = UUID(data)



                return domain_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        domain_id = _parse_domain_id(d.pop("domain_id", UNSET))


        create_filter_input = cls(
            type_=type_,
            pattern=pattern,
            domain_id=domain_id,
        )

        return create_filter_input

