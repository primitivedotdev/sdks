from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_access_mode_result_mode import GetAccessModeResultMode
from typing import cast

if TYPE_CHECKING:
  from ..models.get_access_mode_result_decisions import GetAccessModeResultDecisions
  from ..models.get_access_mode_result_gate import GetAccessModeResultGate
  from ..models.get_access_mode_result_narrowed_agents_item import GetAccessModeResultNarrowedAgentsItem
  from ..models.get_access_mode_result_notices_item import GetAccessModeResultNoticesItem
  from ..models.get_access_mode_result_preview_item import GetAccessModeResultPreviewItem





T = TypeVar("T", bound="GetAccessModeResult")



@_attrs_define
class GetAccessModeResult:
    """ 
        Attributes:
            mode (GetAccessModeResultMode):
            version (float):
            changed_at (None | str):
            preview (list[GetAccessModeResultPreviewItem] | Unset):
            notices (list[GetAccessModeResultNoticesItem] | Unset):
            notices_truncated (bool | Unset):
            notices_unavailable (bool | Unset):
            narrowed_agents (list[GetAccessModeResultNarrowedAgentsItem] | Unset):
            narrowed_agents_truncated (bool | Unset):
            narrowed_agents_unavailable (bool | Unset):
            decisions (GetAccessModeResultDecisions | Unset):
            gate (GetAccessModeResultGate | Unset):
     """

    mode: GetAccessModeResultMode
    version: float
    changed_at: None | str
    preview: list[GetAccessModeResultPreviewItem] | Unset = UNSET
    notices: list[GetAccessModeResultNoticesItem] | Unset = UNSET
    notices_truncated: bool | Unset = UNSET
    notices_unavailable: bool | Unset = UNSET
    narrowed_agents: list[GetAccessModeResultNarrowedAgentsItem] | Unset = UNSET
    narrowed_agents_truncated: bool | Unset = UNSET
    narrowed_agents_unavailable: bool | Unset = UNSET
    decisions: GetAccessModeResultDecisions | Unset = UNSET
    gate: GetAccessModeResultGate | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.get_access_mode_result_decisions import GetAccessModeResultDecisions # noqa: PLC0415
        from ..models.get_access_mode_result_gate import GetAccessModeResultGate # noqa: PLC0415
        from ..models.get_access_mode_result_narrowed_agents_item import GetAccessModeResultNarrowedAgentsItem # noqa: PLC0415
        from ..models.get_access_mode_result_notices_item import GetAccessModeResultNoticesItem # noqa: PLC0415
        from ..models.get_access_mode_result_preview_item import GetAccessModeResultPreviewItem # noqa: PLC0415
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



        notices: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.notices, Unset):
            notices = []
            for notices_item_data in self.notices:
                notices_item = notices_item_data.to_dict()
                notices.append(notices_item)



        notices_truncated = self.notices_truncated

        notices_unavailable = self.notices_unavailable

        narrowed_agents: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.narrowed_agents, Unset):
            narrowed_agents = []
            for narrowed_agents_item_data in self.narrowed_agents:
                narrowed_agents_item = narrowed_agents_item_data.to_dict()
                narrowed_agents.append(narrowed_agents_item)



        narrowed_agents_truncated = self.narrowed_agents_truncated

        narrowed_agents_unavailable = self.narrowed_agents_unavailable

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
        if notices is not UNSET:
            field_dict["notices"] = notices
        if notices_truncated is not UNSET:
            field_dict["notices_truncated"] = notices_truncated
        if notices_unavailable is not UNSET:
            field_dict["notices_unavailable"] = notices_unavailable
        if narrowed_agents is not UNSET:
            field_dict["narrowed_agents"] = narrowed_agents
        if narrowed_agents_truncated is not UNSET:
            field_dict["narrowed_agents_truncated"] = narrowed_agents_truncated
        if narrowed_agents_unavailable is not UNSET:
            field_dict["narrowed_agents_unavailable"] = narrowed_agents_unavailable
        if decisions is not UNSET:
            field_dict["decisions"] = decisions
        if gate is not UNSET:
            field_dict["gate"] = gate

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_access_mode_result_decisions import GetAccessModeResultDecisions # noqa: PLC0415
        from ..models.get_access_mode_result_gate import GetAccessModeResultGate # noqa: PLC0415
        from ..models.get_access_mode_result_narrowed_agents_item import GetAccessModeResultNarrowedAgentsItem # noqa: PLC0415
        from ..models.get_access_mode_result_notices_item import GetAccessModeResultNoticesItem # noqa: PLC0415
        from ..models.get_access_mode_result_preview_item import GetAccessModeResultPreviewItem # noqa: PLC0415
        d = dict(src_dict)
        mode = GetAccessModeResultMode(d.pop("mode"))




        version = d.pop("version")

        def _parse_changed_at(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        changed_at = _parse_changed_at(d.pop("changed_at"))


        _preview = d.pop("preview", UNSET)
        preview: list[GetAccessModeResultPreviewItem] | Unset = UNSET
        if _preview is not UNSET:
            preview = []
            for preview_item_data in _preview:
                preview_item = GetAccessModeResultPreviewItem.from_dict(preview_item_data)



                preview.append(preview_item)


        _notices = d.pop("notices", UNSET)
        notices: list[GetAccessModeResultNoticesItem] | Unset = UNSET
        if _notices is not UNSET:
            notices = []
            for notices_item_data in _notices:
                notices_item = GetAccessModeResultNoticesItem.from_dict(notices_item_data)



                notices.append(notices_item)


        notices_truncated = d.pop("notices_truncated", UNSET)

        notices_unavailable = d.pop("notices_unavailable", UNSET)

        _narrowed_agents = d.pop("narrowed_agents", UNSET)
        narrowed_agents: list[GetAccessModeResultNarrowedAgentsItem] | Unset = UNSET
        if _narrowed_agents is not UNSET:
            narrowed_agents = []
            for narrowed_agents_item_data in _narrowed_agents:
                narrowed_agents_item = GetAccessModeResultNarrowedAgentsItem.from_dict(narrowed_agents_item_data)



                narrowed_agents.append(narrowed_agents_item)


        narrowed_agents_truncated = d.pop("narrowed_agents_truncated", UNSET)

        narrowed_agents_unavailable = d.pop("narrowed_agents_unavailable", UNSET)

        _decisions = d.pop("decisions", UNSET)
        decisions: GetAccessModeResultDecisions | Unset
        if isinstance(_decisions,  Unset):
            decisions = UNSET
        else:
            decisions = GetAccessModeResultDecisions.from_dict(_decisions)




        _gate = d.pop("gate", UNSET)
        gate: GetAccessModeResultGate | Unset
        if isinstance(_gate,  Unset):
            gate = UNSET
        else:
            gate = GetAccessModeResultGate.from_dict(_gate)




        get_access_mode_result = cls(
            mode=mode,
            version=version,
            changed_at=changed_at,
            preview=preview,
            notices=notices,
            notices_truncated=notices_truncated,
            notices_unavailable=notices_unavailable,
            narrowed_agents=narrowed_agents,
            narrowed_agents_truncated=narrowed_agents_truncated,
            narrowed_agents_unavailable=narrowed_agents_unavailable,
            decisions=decisions,
            gate=gate,
        )


        get_access_mode_result.additional_properties = d
        return get_access_mode_result

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
