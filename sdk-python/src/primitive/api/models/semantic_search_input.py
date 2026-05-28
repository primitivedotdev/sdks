from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.semantic_search_field import SemanticSearchField
from ..models.semantic_search_input_corpus_item import SemanticSearchInputCorpusItem
from ..models.semantic_search_input_include_item import SemanticSearchInputIncludeItem
from ..models.semantic_search_input_mode import SemanticSearchInputMode
from dateutil.parser import isoparse
from typing import cast
import datetime






T = TypeVar("T", bound="SemanticSearchInput")



@_attrs_define
class SemanticSearchInput:
    """ 
        Attributes:
            query (str | Unset): Free-text query. Required for `semantic` and `hybrid` modes;
                optional for `keyword` mode.
            mode (SemanticSearchInputMode | Unset): Ranking strategy. `keyword` is lexical only, `semantic` is
                embedding-based, `hybrid` blends both.
                 Default: SemanticSearchInputMode.HYBRID.
            corpus (list[SemanticSearchInputCorpusItem] | Unset): Which mail to search. Defaults to both received
                (`inbound`)
                and sent (`outbound`).
            search_in (list[SemanticSearchField] | Unset): Restrict matching to these fields. Defaults to all.
            exclude (list[SemanticSearchField] | Unset): Exclude these fields from matching.
            date_from (datetime.datetime | Unset): Only include mail at or after this timestamp.
            date_to (datetime.datetime | Unset): Only include mail at or before this timestamp.
            include (list[SemanticSearchInputIncludeItem] | Unset): Opt-in extras. `coverage` adds an index-coverage
                snapshot to
                `meta`. Matched fields, snippets, and the score breakdown are
                always returned regardless of this field.
            limit (int | Unset): Maximum number of results to return. Default: 10.
            cursor (str | Unset): Opaque pagination cursor from a prior response's `meta.cursor`.
     """

    query: str | Unset = UNSET
    mode: SemanticSearchInputMode | Unset = SemanticSearchInputMode.HYBRID
    corpus: list[SemanticSearchInputCorpusItem] | Unset = UNSET
    search_in: list[SemanticSearchField] | Unset = UNSET
    exclude: list[SemanticSearchField] | Unset = UNSET
    date_from: datetime.datetime | Unset = UNSET
    date_to: datetime.datetime | Unset = UNSET
    include: list[SemanticSearchInputIncludeItem] | Unset = UNSET
    limit: int | Unset = 10
    cursor: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        query = self.query

        mode: str | Unset = UNSET
        if not isinstance(self.mode, Unset):
            mode = self.mode.value


        corpus: list[str] | Unset = UNSET
        if not isinstance(self.corpus, Unset):
            corpus = []
            for corpus_item_data in self.corpus:
                corpus_item = corpus_item_data.value
                corpus.append(corpus_item)



        search_in: list[str] | Unset = UNSET
        if not isinstance(self.search_in, Unset):
            search_in = []
            for search_in_item_data in self.search_in:
                search_in_item = search_in_item_data.value
                search_in.append(search_in_item)



        exclude: list[str] | Unset = UNSET
        if not isinstance(self.exclude, Unset):
            exclude = []
            for exclude_item_data in self.exclude:
                exclude_item = exclude_item_data.value
                exclude.append(exclude_item)



        date_from: str | Unset = UNSET
        if not isinstance(self.date_from, Unset):
            date_from = self.date_from.isoformat()

        date_to: str | Unset = UNSET
        if not isinstance(self.date_to, Unset):
            date_to = self.date_to.isoformat()

        include: list[str] | Unset = UNSET
        if not isinstance(self.include, Unset):
            include = []
            for include_item_data in self.include:
                include_item = include_item_data.value
                include.append(include_item)



        limit = self.limit

        cursor = self.cursor


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if query is not UNSET:
            field_dict["query"] = query
        if mode is not UNSET:
            field_dict["mode"] = mode
        if corpus is not UNSET:
            field_dict["corpus"] = corpus
        if search_in is not UNSET:
            field_dict["search_in"] = search_in
        if exclude is not UNSET:
            field_dict["exclude"] = exclude
        if date_from is not UNSET:
            field_dict["date_from"] = date_from
        if date_to is not UNSET:
            field_dict["date_to"] = date_to
        if include is not UNSET:
            field_dict["include"] = include
        if limit is not UNSET:
            field_dict["limit"] = limit
        if cursor is not UNSET:
            field_dict["cursor"] = cursor

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        query = d.pop("query", UNSET)

        _mode = d.pop("mode", UNSET)
        mode: SemanticSearchInputMode | Unset
        if isinstance(_mode,  Unset):
            mode = UNSET
        else:
            mode = SemanticSearchInputMode(_mode)




        _corpus = d.pop("corpus", UNSET)
        corpus: list[SemanticSearchInputCorpusItem] | Unset = UNSET
        if _corpus is not UNSET:
            corpus = []
            for corpus_item_data in _corpus:
                corpus_item = SemanticSearchInputCorpusItem(corpus_item_data)



                corpus.append(corpus_item)


        _search_in = d.pop("search_in", UNSET)
        search_in: list[SemanticSearchField] | Unset = UNSET
        if _search_in is not UNSET:
            search_in = []
            for search_in_item_data in _search_in:
                search_in_item = SemanticSearchField(search_in_item_data)



                search_in.append(search_in_item)


        _exclude = d.pop("exclude", UNSET)
        exclude: list[SemanticSearchField] | Unset = UNSET
        if _exclude is not UNSET:
            exclude = []
            for exclude_item_data in _exclude:
                exclude_item = SemanticSearchField(exclude_item_data)



                exclude.append(exclude_item)


        _date_from = d.pop("date_from", UNSET)
        date_from: datetime.datetime | Unset
        if isinstance(_date_from,  Unset):
            date_from = UNSET
        else:
            date_from = isoparse(_date_from)




        _date_to = d.pop("date_to", UNSET)
        date_to: datetime.datetime | Unset
        if isinstance(_date_to,  Unset):
            date_to = UNSET
        else:
            date_to = isoparse(_date_to)




        _include = d.pop("include", UNSET)
        include: list[SemanticSearchInputIncludeItem] | Unset = UNSET
        if _include is not UNSET:
            include = []
            for include_item_data in _include:
                include_item = SemanticSearchInputIncludeItem(include_item_data)



                include.append(include_item)


        limit = d.pop("limit", UNSET)

        cursor = d.pop("cursor", UNSET)

        semantic_search_input = cls(
            query=query,
            mode=mode,
            corpus=corpus,
            search_in=search_in,
            exclude=exclude,
            date_from=date_from,
            date_to=date_to,
            include=include,
            limit=limit,
            cursor=cursor,
        )


        semantic_search_input.additional_properties = d
        return semantic_search_input

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
