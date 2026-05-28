from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="SemanticSearchCoverage")



@_attrs_define
class SemanticSearchCoverage:
    """ Index-coverage snapshot for the org, returned only when the `coverage` include option is requested.

        Attributes:
            embedded_chunks (int):
            pending_chunks (int):
            skipped_plan_chunks (int):
            skipped_quota_chunks (int):
            unsupported_attachment_chunks (int):
            failed_chunks (int):
     """

    embedded_chunks: int
    pending_chunks: int
    skipped_plan_chunks: int
    skipped_quota_chunks: int
    unsupported_attachment_chunks: int
    failed_chunks: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        embedded_chunks = self.embedded_chunks

        pending_chunks = self.pending_chunks

        skipped_plan_chunks = self.skipped_plan_chunks

        skipped_quota_chunks = self.skipped_quota_chunks

        unsupported_attachment_chunks = self.unsupported_attachment_chunks

        failed_chunks = self.failed_chunks


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "embedded_chunks": embedded_chunks,
            "pending_chunks": pending_chunks,
            "skipped_plan_chunks": skipped_plan_chunks,
            "skipped_quota_chunks": skipped_quota_chunks,
            "unsupported_attachment_chunks": unsupported_attachment_chunks,
            "failed_chunks": failed_chunks,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        embedded_chunks = d.pop("embedded_chunks")

        pending_chunks = d.pop("pending_chunks")

        skipped_plan_chunks = d.pop("skipped_plan_chunks")

        skipped_quota_chunks = d.pop("skipped_quota_chunks")

        unsupported_attachment_chunks = d.pop("unsupported_attachment_chunks")

        failed_chunks = d.pop("failed_chunks")

        semantic_search_coverage = cls(
            embedded_chunks=embedded_chunks,
            pending_chunks=pending_chunks,
            skipped_plan_chunks=skipped_plan_chunks,
            skipped_quota_chunks=skipped_quota_chunks,
            unsupported_attachment_chunks=unsupported_attachment_chunks,
            failed_chunks=failed_chunks,
        )


        semantic_search_coverage.additional_properties = d
        return semantic_search_coverage

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
