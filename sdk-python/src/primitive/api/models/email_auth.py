from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.dkim_signature import DkimSignature





T = TypeVar("T", bound="EmailAuth")



@_attrs_define
class EmailAuth:
    """ SPF / DKIM / DMARC verdicts computed at ingest. Mirrors the
    `email.auth` object on the webhook payload. Field names are
    camelCase to match that payload exactly. For messages received
    before auth was recorded, the verdicts default to `none`.

        Attributes:
            spf (str): SPF result (e.g. `pass`, `fail`, `softfail`, `none`).
            dmarc (str): DMARC result (e.g. `pass`, `fail`, `none`).
            dmarc_spf_aligned (bool):
            dmarc_dkim_aligned (bool):
            dkim_signatures (list[DkimSignature]):
            dmarc_policy (None | str | Unset): Published DMARC policy (`none`, `quarantine`, `reject`).
            dmarc_from_domain (None | str | Unset): The From-header domain DMARC was evaluated against.
            dmarc_spf_strict (bool | None | Unset):
            dmarc_dkim_strict (bool | None | Unset):
     """

    spf: str
    dmarc: str
    dmarc_spf_aligned: bool
    dmarc_dkim_aligned: bool
    dkim_signatures: list[DkimSignature]
    dmarc_policy: None | str | Unset = UNSET
    dmarc_from_domain: None | str | Unset = UNSET
    dmarc_spf_strict: bool | None | Unset = UNSET
    dmarc_dkim_strict: bool | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.dkim_signature import DkimSignature
        spf = self.spf

        dmarc = self.dmarc

        dmarc_spf_aligned = self.dmarc_spf_aligned

        dmarc_dkim_aligned = self.dmarc_dkim_aligned

        dkim_signatures = []
        for dkim_signatures_item_data in self.dkim_signatures:
            dkim_signatures_item = dkim_signatures_item_data.to_dict()
            dkim_signatures.append(dkim_signatures_item)



        dmarc_policy: None | str | Unset
        if isinstance(self.dmarc_policy, Unset):
            dmarc_policy = UNSET
        else:
            dmarc_policy = self.dmarc_policy

        dmarc_from_domain: None | str | Unset
        if isinstance(self.dmarc_from_domain, Unset):
            dmarc_from_domain = UNSET
        else:
            dmarc_from_domain = self.dmarc_from_domain

        dmarc_spf_strict: bool | None | Unset
        if isinstance(self.dmarc_spf_strict, Unset):
            dmarc_spf_strict = UNSET
        else:
            dmarc_spf_strict = self.dmarc_spf_strict

        dmarc_dkim_strict: bool | None | Unset
        if isinstance(self.dmarc_dkim_strict, Unset):
            dmarc_dkim_strict = UNSET
        else:
            dmarc_dkim_strict = self.dmarc_dkim_strict


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "spf": spf,
            "dmarc": dmarc,
            "dmarcSpfAligned": dmarc_spf_aligned,
            "dmarcDkimAligned": dmarc_dkim_aligned,
            "dkimSignatures": dkim_signatures,
        })
        if dmarc_policy is not UNSET:
            field_dict["dmarcPolicy"] = dmarc_policy
        if dmarc_from_domain is not UNSET:
            field_dict["dmarcFromDomain"] = dmarc_from_domain
        if dmarc_spf_strict is not UNSET:
            field_dict["dmarcSpfStrict"] = dmarc_spf_strict
        if dmarc_dkim_strict is not UNSET:
            field_dict["dmarcDkimStrict"] = dmarc_dkim_strict

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.dkim_signature import DkimSignature
        d = dict(src_dict)
        spf = d.pop("spf")

        dmarc = d.pop("dmarc")

        dmarc_spf_aligned = d.pop("dmarcSpfAligned")

        dmarc_dkim_aligned = d.pop("dmarcDkimAligned")

        dkim_signatures = []
        _dkim_signatures = d.pop("dkimSignatures")
        for dkim_signatures_item_data in (_dkim_signatures):
            dkim_signatures_item = DkimSignature.from_dict(dkim_signatures_item_data)



            dkim_signatures.append(dkim_signatures_item)


        def _parse_dmarc_policy(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        dmarc_policy = _parse_dmarc_policy(d.pop("dmarcPolicy", UNSET))


        def _parse_dmarc_from_domain(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        dmarc_from_domain = _parse_dmarc_from_domain(d.pop("dmarcFromDomain", UNSET))


        def _parse_dmarc_spf_strict(data: object) -> bool | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(bool | None | Unset, data)

        dmarc_spf_strict = _parse_dmarc_spf_strict(d.pop("dmarcSpfStrict", UNSET))


        def _parse_dmarc_dkim_strict(data: object) -> bool | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(bool | None | Unset, data)

        dmarc_dkim_strict = _parse_dmarc_dkim_strict(d.pop("dmarcDkimStrict", UNSET))


        email_auth = cls(
            spf=spf,
            dmarc=dmarc,
            dmarc_spf_aligned=dmarc_spf_aligned,
            dmarc_dkim_aligned=dmarc_dkim_aligned,
            dkim_signatures=dkim_signatures,
            dmarc_policy=dmarc_policy,
            dmarc_from_domain=dmarc_from_domain,
            dmarc_spf_strict=dmarc_spf_strict,
            dmarc_dkim_strict=dmarc_dkim_strict,
        )


        email_auth.additional_properties = d
        return email_auth

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
