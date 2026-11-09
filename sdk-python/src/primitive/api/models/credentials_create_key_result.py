from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.credentials_create_key_result_address_warnings_item import CredentialsCreateKeyResultAddressWarningsItem
  from ..models.credentials_create_key_result_grant import CredentialsCreateKeyResultGrant
  from ..models.credentials_create_key_result_warnings_item import CredentialsCreateKeyResultWarningsItem





T = TypeVar("T", bound="CredentialsCreateKeyResult")



@_attrs_define
class CredentialsCreateKeyResult:
    """ 
        Attributes:
            id (str):
            name (None | str):
            key (str):
            key_prefix (str):
            grant (CredentialsCreateKeyResultGrant):
            expires_at (datetime.datetime | None):
            conditions (Any):
            warnings (list[CredentialsCreateKeyResultWarningsItem]):
            address_warnings (list[CredentialsCreateKeyResultAddressWarningsItem] | Unset):
            replaced_key_ids (list[str] | Unset):
     """

    id: str
    name: None | str
    key: str
    key_prefix: str
    grant: CredentialsCreateKeyResultGrant
    expires_at: datetime.datetime | None
    conditions: Any
    warnings: list[CredentialsCreateKeyResultWarningsItem]
    address_warnings: list[CredentialsCreateKeyResultAddressWarningsItem] | Unset = UNSET
    replaced_key_ids: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.credentials_create_key_result_address_warnings_item import CredentialsCreateKeyResultAddressWarningsItem # noqa: PLC0415
        from ..models.credentials_create_key_result_grant import CredentialsCreateKeyResultGrant # noqa: PLC0415
        from ..models.credentials_create_key_result_warnings_item import CredentialsCreateKeyResultWarningsItem # noqa: PLC0415
        id = self.id

        name: None | str
        name = self.name

        key = self.key

        key_prefix = self.key_prefix

        grant = self.grant.to_dict()

        expires_at: None | str
        if isinstance(self.expires_at, datetime.datetime):
            expires_at = self.expires_at.isoformat()
        else:
            expires_at = self.expires_at

        conditions = self.conditions

        warnings = []
        for warnings_item_data in self.warnings:
            warnings_item = warnings_item_data.to_dict()
            warnings.append(warnings_item)



        address_warnings: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.address_warnings, Unset):
            address_warnings = []
            for address_warnings_item_data in self.address_warnings:
                address_warnings_item = address_warnings_item_data.to_dict()
                address_warnings.append(address_warnings_item)



        replaced_key_ids: list[str] | Unset = UNSET
        if not isinstance(self.replaced_key_ids, Unset):
            replaced_key_ids = self.replaced_key_ids




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "name": name,
            "key": key,
            "key_prefix": key_prefix,
            "grant": grant,
            "expires_at": expires_at,
            "conditions": conditions,
            "warnings": warnings,
        })
        if address_warnings is not UNSET:
            field_dict["address_warnings"] = address_warnings
        if replaced_key_ids is not UNSET:
            field_dict["replaced_key_ids"] = replaced_key_ids

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.credentials_create_key_result_address_warnings_item import CredentialsCreateKeyResultAddressWarningsItem # noqa: PLC0415
        from ..models.credentials_create_key_result_grant import CredentialsCreateKeyResultGrant # noqa: PLC0415
        from ..models.credentials_create_key_result_warnings_item import CredentialsCreateKeyResultWarningsItem # noqa: PLC0415
        d = dict(src_dict)
        id = d.pop("id")

        def _parse_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        name = _parse_name(d.pop("name"))


        key = d.pop("key")

        key_prefix = d.pop("key_prefix")

        grant = CredentialsCreateKeyResultGrant.from_dict(d.pop("grant"))




        def _parse_expires_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                expires_at_type_0 = datetime.datetime.fromisoformat(data)



                return expires_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        expires_at = _parse_expires_at(d.pop("expires_at"))


        conditions = d.pop("conditions")

        warnings = []
        _warnings = d.pop("warnings")
        for warnings_item_data in (_warnings):
            warnings_item = CredentialsCreateKeyResultWarningsItem.from_dict(warnings_item_data)



            warnings.append(warnings_item)


        _address_warnings = d.pop("address_warnings", UNSET)
        address_warnings: list[CredentialsCreateKeyResultAddressWarningsItem] | Unset = UNSET
        if _address_warnings is not UNSET:
            address_warnings = []
            for address_warnings_item_data in _address_warnings:
                address_warnings_item = CredentialsCreateKeyResultAddressWarningsItem.from_dict(address_warnings_item_data)



                address_warnings.append(address_warnings_item)


        replaced_key_ids = cast(list[str], d.pop("replaced_key_ids", UNSET))


        credentials_create_key_result = cls(
            id=id,
            name=name,
            key=key,
            key_prefix=key_prefix,
            grant=grant,
            expires_at=expires_at,
            conditions=conditions,
            warnings=warnings,
            address_warnings=address_warnings,
            replaced_key_ids=replaced_key_ids,
        )


        credentials_create_key_result.additional_properties = d
        return credentials_create_key_result

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
