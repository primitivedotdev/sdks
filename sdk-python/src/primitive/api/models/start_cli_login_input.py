from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.start_cli_login_input_login_kind import StartCliLoginInputLoginKind
from typing import cast

if TYPE_CHECKING:
  from ..models.start_cli_login_input_metadata import StartCliLoginInputMetadata





T = TypeVar("T", bound="StartCliLoginInput")



@_attrs_define
class StartCliLoginInput:
    """ 
        Attributes:
            device_name (str | Unset): Human-readable device name shown during browser approval
            metadata (StartCliLoginInputMetadata | Unset): Optional client metadata stored with the login session;
                serialized JSON must be 2048 bytes or fewer
            login_kind (StartCliLoginInputLoginKind | Unset): `user` asks for a login as the person, not bound to one
                organization, that can switch between the person's organizations
                (see `CliUserLoginPollResult`). Servers without this answer
                `400 validation_error`; clients then retry without the field.
            requested_grant (str | Unset): Narrow the login's grant. Only `primitive:api` (the person's own
                grant, as when omitted) is accepted; anything else answers
                `400 grant_not_available`.
     """

    device_name: str | Unset = UNSET
    metadata: StartCliLoginInputMetadata | Unset = UNSET
    login_kind: StartCliLoginInputLoginKind | Unset = UNSET
    requested_grant: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.start_cli_login_input_metadata import StartCliLoginInputMetadata # noqa: PLC0415
        device_name = self.device_name

        metadata: dict[str, Any] | Unset = UNSET
        if not isinstance(self.metadata, Unset):
            metadata = self.metadata.to_dict()

        login_kind: str | Unset = UNSET
        if not isinstance(self.login_kind, Unset):
            login_kind = self.login_kind.value


        requested_grant = self.requested_grant


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if device_name is not UNSET:
            field_dict["device_name"] = device_name
        if metadata is not UNSET:
            field_dict["metadata"] = metadata
        if login_kind is not UNSET:
            field_dict["login_kind"] = login_kind
        if requested_grant is not UNSET:
            field_dict["requested_grant"] = requested_grant

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.start_cli_login_input_metadata import StartCliLoginInputMetadata # noqa: PLC0415
        d = dict(src_dict)
        device_name = d.pop("device_name", UNSET)

        _metadata = d.pop("metadata", UNSET)
        metadata: StartCliLoginInputMetadata | Unset
        if isinstance(_metadata,  Unset):
            metadata = UNSET
        else:
            metadata = StartCliLoginInputMetadata.from_dict(_metadata)




        _login_kind = d.pop("login_kind", UNSET)
        login_kind: StartCliLoginInputLoginKind | Unset
        if isinstance(_login_kind,  Unset):
            login_kind = UNSET
        else:
            login_kind = StartCliLoginInputLoginKind(_login_kind)




        requested_grant = d.pop("requested_grant", UNSET)

        start_cli_login_input = cls(
            device_name=device_name,
            metadata=metadata,
            login_kind=login_kind,
            requested_grant=requested_grant,
        )

        return start_cli_login_input

