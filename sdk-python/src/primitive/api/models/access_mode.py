from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.access_mode_mode import AccessModeMode
from typing import cast

if TYPE_CHECKING:
  from ..models.access_mode_decisions import AccessModeDecisions
  from ..models.access_mode_gate import AccessModeGate
  from ..models.access_mode_preview_item import AccessModePreviewItem





T = TypeVar("T", bound="AccessMode")



@_attrs_define
class AccessMode:
    """ 
        Attributes:
            mode (AccessModeMode):
            version (int):
            changed_at (None | str):
            preview (list[AccessModePreviewItem] | Unset):
            decisions (AccessModeDecisions | Unset):
            gate (AccessModeGate | Unset):
     """

    mode: AccessModeMode
    version: int
    changed_at: None | str
    preview: list[AccessModePreviewItem] | Unset = UNSET
    decisions: AccessModeDecisions | Unset = UNSET
    gate: AccessModeGate | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.access_mode_decisions import AccessModeDecisions # noqa: PLC0415
        from ..models.access_mode_gate import AccessModeGate # noqa: PLC0415
        from ..models.access_mode_preview_item import AccessModePreviewItem # noqa: PLC0415
        mode = self.mode.value

        version = self.version

        changed_at: None | str
        changed_at = self.changed_at

        preview: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.preview, Unset):
            preview = []
            for preview_item_data in self.preview:
                preview_item = preview_item_data.to_dict()
                preview.append(preview_item)



        decisions: dict[str, Any] | Unset = UNSET
        if not isinstance(self.decisions, Unset):
            decisions = self.decisions.to_dict()

        gate: dict[str, Any] | Unset = UNSET
        if not isinstance(self.gate, Unset):
            gate = self.gate.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "mode": mode,
            "version": version,
            "changed_at": changed_at,
        })
        if preview is not UNSET:
            field_dict["preview"] = preview
        if decisions is not UNSET:
            field_dict["decisions"] = decisions
        if gate is not UNSET:
            field_dict["gate"] = gate

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.access_mode_decisions import AccessModeDecisions # noqa: PLC0415
        from ..models.access_mode_gate import AccessModeGate # noqa: PLC0415
        from ..models.access_mode_preview_item import AccessModePreviewItem # noqa: PLC0415
        d = dict(src_dict)
        mode = AccessModeMode(d.pop("mode"))




        version = d.pop("version")

        def _parse_changed_at(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        changed_at = _parse_changed_at(d.pop("changed_at"))


        _preview = d.pop("preview", UNSET)
        preview: list[AccessModePreviewItem] | Unset = UNSET
        if _preview is not UNSET:
            preview = []
            for preview_item_data in _preview:
                preview_item = AccessModePreviewItem.from_dict(preview_item_data)



                preview.append(preview_item)


        _decisions = d.pop("decisions", UNSET)
        decisions: AccessModeDecisions | Unset
        if isinstance(_decisions,  Unset):
            decisions = UNSET
        else:
            decisions = AccessModeDecisions.from_dict(_decisions)




        _gate = d.pop("gate", UNSET)
        gate: AccessModeGate | Unset
        if isinstance(_gate,  Unset):
            gate = UNSET
        else:
            gate = AccessModeGate.from_dict(_gate)




        access_mode = cls(
            mode=mode,
            version=version,
            changed_at=changed_at,
            preview=preview,
            decisions=decisions,
            gate=gate,
        )


        access_mode.additional_properties = d
        return access_mode

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
