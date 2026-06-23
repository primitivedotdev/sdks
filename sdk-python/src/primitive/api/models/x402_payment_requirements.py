from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.x402_payment_requirements_network import X402PaymentRequirementsNetwork
from typing import cast

if TYPE_CHECKING:
  from ..models.x402_payment_requirements_extra import X402PaymentRequirementsExtra





T = TypeVar("T", bound="X402PaymentRequirements")



@_attrs_define
class X402PaymentRequirements:
    """ The x402 `PaymentRequirements` the payer signs over. Field names are
    x402's native camelCase, preserved byte-for-byte.

        Attributes:
            scheme (str): The x402 settlement scheme. Always `exact` for v1. Example: exact.
            network (X402PaymentRequirementsNetwork):
            max_amount_required (str): Amount in token base units.
            pay_to (str): The payee's resolved payout address (checksummed).
            asset (str): The token contract address (checksummed). USDC.
            extra (X402PaymentRequirementsExtra): The token's load-bearing EIP-712 domain params. `name` differs by
                chain (Base mainnet USDC is `USD Coin`, Base Sepolia is `USDC`); a
                wrong value produces a signature the verifier rejects.
            resource (str | Unset):
            description (str | Unset):
            max_timeout_seconds (int | Unset):
     """

    scheme: str
    network: X402PaymentRequirementsNetwork
    max_amount_required: str
    pay_to: str
    asset: str
    extra: X402PaymentRequirementsExtra
    resource: str | Unset = UNSET
    description: str | Unset = UNSET
    max_timeout_seconds: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.x402_payment_requirements_extra import X402PaymentRequirementsExtra
        scheme = self.scheme

        network = self.network.value

        max_amount_required = self.max_amount_required

        pay_to = self.pay_to

        asset = self.asset

        extra = self.extra.to_dict()

        resource = self.resource

        description = self.description

        max_timeout_seconds = self.max_timeout_seconds


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "scheme": scheme,
            "network": network,
            "maxAmountRequired": max_amount_required,
            "payTo": pay_to,
            "asset": asset,
            "extra": extra,
        })
        if resource is not UNSET:
            field_dict["resource"] = resource
        if description is not UNSET:
            field_dict["description"] = description
        if max_timeout_seconds is not UNSET:
            field_dict["maxTimeoutSeconds"] = max_timeout_seconds

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.x402_payment_requirements_extra import X402PaymentRequirementsExtra
        d = dict(src_dict)
        scheme = d.pop("scheme")

        network = X402PaymentRequirementsNetwork(d.pop("network"))




        max_amount_required = d.pop("maxAmountRequired")

        pay_to = d.pop("payTo")

        asset = d.pop("asset")

        extra = X402PaymentRequirementsExtra.from_dict(d.pop("extra"))




        resource = d.pop("resource", UNSET)

        description = d.pop("description", UNSET)

        max_timeout_seconds = d.pop("maxTimeoutSeconds", UNSET)

        x402_payment_requirements = cls(
            scheme=scheme,
            network=network,
            max_amount_required=max_amount_required,
            pay_to=pay_to,
            asset=asset,
            extra=extra,
            resource=resource,
            description=description,
            max_timeout_seconds=max_timeout_seconds,
        )


        x402_payment_requirements.additional_properties = d
        return x402_payment_requirements

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
