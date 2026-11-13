from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.list_activity_objects_result_items_item import ListActivityObjectsResultItemsItem
  from ..models.list_activity_objects_result_withheld_item import ListActivityObjectsResultWithheldItem





T = TypeVar("T", bound="ListActivityObjectsResult")



@_attrs_define
class ListActivityObjectsResult:
    """ 
        Attributes:
            covers (str): you: what a person created through any credential of theirs, or with relation=asked what others
                asked of them (their dashboard session, their own CLI or app login, apps and agent delegates acting for them,
                their API keys while theirs, their personal agents). this_credential: what the calling key, app or agent created
                itself.
            items (list[ListActivityObjectsResultItemsItem]):
            withheld (list[ListActivityObjectsResultWithheldItem]): Kinds left out because the caller could not list them
                through their own routes. Nothing is said about how many there are.
            next_cursor (None | str): Pass as cursor to read the next page; null on the last page. A page can hold fewer
                items than limit, or none, while next_cursor is set.
            as_of (datetime.datetime | None | Unset): With relation=concerning only: about when the notices last looked at
                your organization; null if never or unread. Coverage since may have no notice yet.
            pending_complete (bool | Unset): With relation=concerning, on the first page only: whether the check for rules
                that started covering you without their start notice (state pending, listed ahead of the notices and beyond
                limit) was finished. false: some may be missing. Absent where there is nothing to check.
     """

    covers: str
    items: list[ListActivityObjectsResultItemsItem]
    withheld: list[ListActivityObjectsResultWithheldItem]
    next_cursor: None | str
    as_of: datetime.datetime | None | Unset = UNSET
    pending_complete: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_activity_objects_result_items_item import ListActivityObjectsResultItemsItem # noqa: PLC0415
        from ..models.list_activity_objects_result_withheld_item import ListActivityObjectsResultWithheldItem # noqa: PLC0415
        covers = self.covers

        items = []
        for items_item_data in self.items:
            items_item = items_item_data.to_dict()
            items.append(items_item)



        withheld = []
        for withheld_item_data in self.withheld:
            withheld_item = withheld_item_data.to_dict()
            withheld.append(withheld_item)



        next_cursor: None | str
        next_cursor = self.next_cursor

        as_of: None | str | Unset
        if isinstance(self.as_of, Unset):
            as_of = UNSET
        elif isinstance(self.as_of, datetime.datetime):
            as_of = self.as_of.isoformat()
        else:
            as_of = self.as_of

        pending_complete = self.pending_complete


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "covers": covers,
            "items": items,
            "withheld": withheld,
            "next_cursor": next_cursor,
        })
        if as_of is not UNSET:
            field_dict["as_of"] = as_of
        if pending_complete is not UNSET:
            field_dict["pending_complete"] = pending_complete

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_activity_objects_result_items_item import ListActivityObjectsResultItemsItem # noqa: PLC0415
        from ..models.list_activity_objects_result_withheld_item import ListActivityObjectsResultWithheldItem # noqa: PLC0415
        d = dict(src_dict)
        covers = d.pop("covers")

        items = []
        _items = d.pop("items")
        for items_item_data in (_items):
            items_item = ListActivityObjectsResultItemsItem.from_dict(items_item_data)



            items.append(items_item)


        withheld = []
        _withheld = d.pop("withheld")
        for withheld_item_data in (_withheld):
            withheld_item = ListActivityObjectsResultWithheldItem.from_dict(withheld_item_data)



            withheld.append(withheld_item)


        def _parse_next_cursor(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        next_cursor = _parse_next_cursor(d.pop("next_cursor"))


        def _parse_as_of(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                as_of_type_0 = datetime.datetime.fromisoformat(data)



                return as_of_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        as_of = _parse_as_of(d.pop("as_of", UNSET))


        pending_complete = d.pop("pending_complete", UNSET)

        list_activity_objects_result = cls(
            covers=covers,
            items=items,
            withheld=withheld,
            next_cursor=next_cursor,
            as_of=as_of,
            pending_complete=pending_complete,
        )


        list_activity_objects_result.additional_properties = d
        return list_activity_objects_result

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
