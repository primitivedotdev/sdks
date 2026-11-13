from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_rule_tested_kind import EmailRuleTestedKind
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="EmailRuleTested")



@_attrs_define
class EmailRuleTested:
    """ 
        Attributes:
            id (None | UUID):
            version (int | None):
            vocabulary (str):
            kind (EmailRuleTestedKind | Unset): The kind it was tested as.
            note (str | Unset): Present when a tree was sent without kind, so it was tested as grant.
     """

    id: None | UUID
    version: int | None
    vocabulary: str
    kind: EmailRuleTestedKind | Unset = UNSET
    note: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id: None | str
        if isinstance(self.id, UUID):
            id = str(self.id)
        else:
            id = self.id

        version: int | None
        version = self.version

        vocabulary = self.vocabulary

        kind: str | Unset = UNSET
        if not isinstance(self.kind, Unset):
            kind = self.kind.value


        note = self.note


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "version": version,
            "vocabulary": vocabulary,
        })
        if kind is not UNSET:
            field_dict["kind"] = kind
        if note is not UNSET:
            field_dict["note"] = note

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                id_type_0 = UUID(data)



                return id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        id = _parse_id(d.pop("id"))


        def _parse_version(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        version = _parse_version(d.pop("version"))


        vocabulary = d.pop("vocabulary")

        _kind = d.pop("kind", UNSET)
        kind: EmailRuleTestedKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = EmailRuleTestedKind(_kind)




        note = d.pop("note", UNSET)

        email_rule_tested = cls(
            id=id,
            version=version,
            vocabulary=vocabulary,
            kind=kind,
            note=note,
        )


        email_rule_tested.additional_properties = d
        return email_rule_tested

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
