from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="PrepareContactRequestResponse200DataRequest")



@_attrs_define
class PrepareContactRequestResponse200DataRequest:
    """ Identity of the prepared step. Keep interaction_id, step_id and expires_at to match a later acceptance.

        Attributes:
            interaction_id (str | Unset):
            step_id (UUID | Unset):
            prev_step_id (None | Unset | UUID):
            expires_at (datetime.datetime | Unset):
     """

    interaction_id: str | Unset = UNSET
    step_id: UUID | Unset = UNSET
    prev_step_id: None | Unset | UUID = UNSET
    expires_at: datetime.datetime | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        interaction_id = self.interaction_id

        step_id: str | Unset = UNSET
        if not isinstance(self.step_id, Unset):
            step_id = str(self.step_id)

        prev_step_id: None | str | Unset
        if isinstance(self.prev_step_id, Unset):
            prev_step_id = UNSET
        elif isinstance(self.prev_step_id, UUID):
            prev_step_id = str(self.prev_step_id)
        else:
            prev_step_id = self.prev_step_id

        expires_at: str | Unset = UNSET
        if not isinstance(self.expires_at, Unset):
            expires_at = self.expires_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if interaction_id is not UNSET:
            field_dict["interaction_id"] = interaction_id
        if step_id is not UNSET:
            field_dict["step_id"] = step_id
        if prev_step_id is not UNSET:
            field_dict["prev_step_id"] = prev_step_id
        if expires_at is not UNSET:
            field_dict["expires_at"] = expires_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        interaction_id = d.pop("interaction_id", UNSET)

        _step_id = d.pop("step_id", UNSET)
        step_id: UUID | Unset
        if isinstance(_step_id,  Unset):
            step_id = UNSET
        else:
            step_id = UUID(_step_id)




        def _parse_prev_step_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                prev_step_id_type_0 = UUID(data)



                return prev_step_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        prev_step_id = _parse_prev_step_id(d.pop("prev_step_id", UNSET))


        _expires_at = d.pop("expires_at", UNSET)
        expires_at: datetime.datetime | Unset
        if isinstance(_expires_at,  Unset):
            expires_at = UNSET
        else:
            expires_at = datetime.datetime.fromisoformat(_expires_at)




        prepare_contact_request_response_200_data_request = cls(
            interaction_id=interaction_id,
            step_id=step_id,
            prev_step_id=prev_step_id,
            expires_at=expires_at,
        )


        prepare_contact_request_response_200_data_request.additional_properties = d
        return prepare_contact_request_response_200_data_request

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
