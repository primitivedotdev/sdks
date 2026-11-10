from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.list_email_rule_scope_options_result_reach import ListEmailRuleScopeOptionsResultReach
from typing import cast






T = TypeVar("T", bound="ListEmailRuleScopeOptionsResult")



@_attrs_define
class ListEmailRuleScopeOptionsResult:
    """ 
        Attributes:
            reach (ListEmailRuleScopeOptionsResultReach): organization: all of the organization's mail. own: only your own.
                limited: some inboxes or domains.
            own_mail (bool): Whether a rule over only your own mail would run for you.
            addresses (list[str]): Inboxes you can read, matching q.
            domains (list[str]): Domains you can read, matching q.
            more (bool): More match than are listed.
            own_mail_to_block (bool | Unset): Whether a do_not_share rule over only your own mail would run for you: it
                covers every own mailbox you read, including ones you could not share.
     """

    reach: ListEmailRuleScopeOptionsResultReach
    own_mail: bool
    addresses: list[str]
    domains: list[str]
    more: bool
    own_mail_to_block: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        reach = self.reach.value

        own_mail = self.own_mail

        addresses = self.addresses



        domains = self.domains



        more = self.more

        own_mail_to_block = self.own_mail_to_block


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "reach": reach,
            "own_mail": own_mail,
            "addresses": addresses,
            "domains": domains,
            "more": more,
        })
        if own_mail_to_block is not UNSET:
            field_dict["own_mail_to_block"] = own_mail_to_block

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        reach = ListEmailRuleScopeOptionsResultReach(d.pop("reach"))




        own_mail = d.pop("own_mail")

        addresses = cast(list[str], d.pop("addresses"))


        domains = cast(list[str], d.pop("domains"))


        more = d.pop("more")

        own_mail_to_block = d.pop("own_mail_to_block", UNSET)

        list_email_rule_scope_options_result = cls(
            reach=reach,
            own_mail=own_mail,
            addresses=addresses,
            domains=domains,
            more=more,
            own_mail_to_block=own_mail_to_block,
        )


        list_email_rule_scope_options_result.additional_properties = d
        return list_email_rule_scope_options_result

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
