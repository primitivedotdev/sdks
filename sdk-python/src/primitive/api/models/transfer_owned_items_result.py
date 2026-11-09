from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.transfer_owned_items_result_redeploy_failed_item import TransferOwnedItemsResultRedeployFailedItem
  from ..models.transfer_owned_items_result_refused_item import TransferOwnedItemsResultRefusedItem
  from ..models.transfer_owned_items_result_rotated_item import TransferOwnedItemsResultRotatedItem
  from ..models.transfer_owned_items_result_transferred_item import TransferOwnedItemsResultTransferredItem





T = TypeVar("T", bound="TransferOwnedItemsResult")



@_attrs_define
class TransferOwnedItemsResult:
    """ 
        Attributes:
            transferred (list[TransferOwnedItemsResultTransferredItem]):
            refused (list[TransferOwnedItemsResultRefusedItem]):
            rotated (list[TransferOwnedItemsResultRotatedItem]):
            unrotated_keys (list[str]):
            redeploy_failed (list[TransferOwnedItemsResultRedeployFailedItem]):
            warning (None | str):
            ended_predecessors (list[str] | Unset):
            stopped_until_redeploy (list[str] | Unset):
            stopped_until_enabled (list[str] | Unset):
            transfer_stop_pending (list[str] | Unset):
     """

    transferred: list[TransferOwnedItemsResultTransferredItem]
    refused: list[TransferOwnedItemsResultRefusedItem]
    rotated: list[TransferOwnedItemsResultRotatedItem]
    unrotated_keys: list[str]
    redeploy_failed: list[TransferOwnedItemsResultRedeployFailedItem]
    warning: None | str
    ended_predecessors: list[str] | Unset = UNSET
    stopped_until_redeploy: list[str] | Unset = UNSET
    stopped_until_enabled: list[str] | Unset = UNSET
    transfer_stop_pending: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.transfer_owned_items_result_redeploy_failed_item import TransferOwnedItemsResultRedeployFailedItem # noqa: PLC0415
        from ..models.transfer_owned_items_result_refused_item import TransferOwnedItemsResultRefusedItem # noqa: PLC0415
        from ..models.transfer_owned_items_result_rotated_item import TransferOwnedItemsResultRotatedItem # noqa: PLC0415
        from ..models.transfer_owned_items_result_transferred_item import TransferOwnedItemsResultTransferredItem # noqa: PLC0415
        transferred = []
        for transferred_item_data in self.transferred:
            transferred_item = transferred_item_data.to_dict()
            transferred.append(transferred_item)



        refused = []
        for refused_item_data in self.refused:
            refused_item = refused_item_data.to_dict()
            refused.append(refused_item)



        rotated = []
        for rotated_item_data in self.rotated:
            rotated_item = rotated_item_data.to_dict()
            rotated.append(rotated_item)



        unrotated_keys = self.unrotated_keys



        redeploy_failed = []
        for redeploy_failed_item_data in self.redeploy_failed:
            redeploy_failed_item = redeploy_failed_item_data.to_dict()
            redeploy_failed.append(redeploy_failed_item)



        warning: None | str
        warning = self.warning

        ended_predecessors: list[str] | Unset = UNSET
        if not isinstance(self.ended_predecessors, Unset):
            ended_predecessors = self.ended_predecessors



        stopped_until_redeploy: list[str] | Unset = UNSET
        if not isinstance(self.stopped_until_redeploy, Unset):
            stopped_until_redeploy = self.stopped_until_redeploy



        stopped_until_enabled: list[str] | Unset = UNSET
        if not isinstance(self.stopped_until_enabled, Unset):
            stopped_until_enabled = self.stopped_until_enabled



        transfer_stop_pending: list[str] | Unset = UNSET
        if not isinstance(self.transfer_stop_pending, Unset):
            transfer_stop_pending = self.transfer_stop_pending




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "transferred": transferred,
            "refused": refused,
            "rotated": rotated,
            "unrotated_keys": unrotated_keys,
            "redeploy_failed": redeploy_failed,
            "warning": warning,
        })
        if ended_predecessors is not UNSET:
            field_dict["ended_predecessors"] = ended_predecessors
        if stopped_until_redeploy is not UNSET:
            field_dict["stopped_until_redeploy"] = stopped_until_redeploy
        if stopped_until_enabled is not UNSET:
            field_dict["stopped_until_enabled"] = stopped_until_enabled
        if transfer_stop_pending is not UNSET:
            field_dict["transfer_stop_pending"] = transfer_stop_pending

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.transfer_owned_items_result_redeploy_failed_item import TransferOwnedItemsResultRedeployFailedItem # noqa: PLC0415
        from ..models.transfer_owned_items_result_refused_item import TransferOwnedItemsResultRefusedItem # noqa: PLC0415
        from ..models.transfer_owned_items_result_rotated_item import TransferOwnedItemsResultRotatedItem # noqa: PLC0415
        from ..models.transfer_owned_items_result_transferred_item import TransferOwnedItemsResultTransferredItem # noqa: PLC0415
        d = dict(src_dict)
        transferred = []
        _transferred = d.pop("transferred")
        for transferred_item_data in (_transferred):
            transferred_item = TransferOwnedItemsResultTransferredItem.from_dict(transferred_item_data)



            transferred.append(transferred_item)


        refused = []
        _refused = d.pop("refused")
        for refused_item_data in (_refused):
            refused_item = TransferOwnedItemsResultRefusedItem.from_dict(refused_item_data)



            refused.append(refused_item)


        rotated = []
        _rotated = d.pop("rotated")
        for rotated_item_data in (_rotated):
            rotated_item = TransferOwnedItemsResultRotatedItem.from_dict(rotated_item_data)



            rotated.append(rotated_item)


        unrotated_keys = cast(list[str], d.pop("unrotated_keys"))


        redeploy_failed = []
        _redeploy_failed = d.pop("redeploy_failed")
        for redeploy_failed_item_data in (_redeploy_failed):
            redeploy_failed_item = TransferOwnedItemsResultRedeployFailedItem.from_dict(redeploy_failed_item_data)



            redeploy_failed.append(redeploy_failed_item)


        def _parse_warning(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        warning = _parse_warning(d.pop("warning"))


        ended_predecessors = cast(list[str], d.pop("ended_predecessors", UNSET))


        stopped_until_redeploy = cast(list[str], d.pop("stopped_until_redeploy", UNSET))


        stopped_until_enabled = cast(list[str], d.pop("stopped_until_enabled", UNSET))


        transfer_stop_pending = cast(list[str], d.pop("transfer_stop_pending", UNSET))


        transfer_owned_items_result = cls(
            transferred=transferred,
            refused=refused,
            rotated=rotated,
            unrotated_keys=unrotated_keys,
            redeploy_failed=redeploy_failed,
            warning=warning,
            ended_predecessors=ended_predecessors,
            stopped_until_redeploy=stopped_until_redeploy,
            stopped_until_enabled=stopped_until_enabled,
            transfer_stop_pending=transfer_stop_pending,
        )


        transfer_owned_items_result.additional_properties = d
        return transfer_owned_items_result

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
