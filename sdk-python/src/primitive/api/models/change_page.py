from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.change import Change





T = TypeVar("T", bound="ChangePage")



@_attrs_define
class ChangePage:
    """ 
        Attributes:
            changes (list[Change]): Oldest first, in commit order.
            next_cursor (str): Always present. Send it unchanged as `since` next time, and store it only after applying the
                page. It is exactly the `since` you sent when nothing at all happened after it; it moves past changes this
                credential cannot see, so the page can be empty with a new cursor.
            has_more (bool): More changes are already pending: call again at once, without waiting.
            baseline (bool): True only for a `since=start` request, whose page is always empty.
     """

    changes: list[Change]
    next_cursor: str
    has_more: bool
    baseline: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.change import Change # noqa: PLC0415
        changes = []
        for changes_item_data in self.changes:
            changes_item = changes_item_data.to_dict()
            changes.append(changes_item)



        next_cursor = self.next_cursor

        has_more = self.has_more

        baseline = self.baseline


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "changes": changes,
            "next_cursor": next_cursor,
            "has_more": has_more,
            "baseline": baseline,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.change import Change # noqa: PLC0415
        d = dict(src_dict)
        changes = []
        _changes = d.pop("changes")
        for changes_item_data in (_changes):
            changes_item = Change.from_dict(changes_item_data)



            changes.append(changes_item)


        next_cursor = d.pop("next_cursor")

        has_more = d.pop("has_more")

        baseline = d.pop("baseline")

        change_page = cls(
            changes=changes,
            next_cursor=next_cursor,
            has_more=has_more,
            baseline=baseline,
        )

        return change_page

