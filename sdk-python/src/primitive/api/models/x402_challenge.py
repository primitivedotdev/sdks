from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.x402_challenge_network import X402ChallengeNetwork
from ..models.x402_challenge_status import X402ChallengeStatus
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.x402_nonce_binding import X402NonceBinding
  from ..models.x402_payment_requirements import X402PaymentRequirements





T = TypeVar("T", bound="X402Challenge")



@_attrs_define
class X402Challenge:
    """ 
        Attributes:
            id (UUID):
            status (X402ChallengeStatus):
            network (X402ChallengeNetwork):
            asset (str): Token contract address (checksummed).
            amount (str): Amount in token base units.
            pay_to (str): The payee's resolved payout address (checksummed).
            nonce_binding (X402NonceBinding): The interaction binding the payer hashes into the EIP-3009 nonce
                (`deriveEip3009Nonce`). Pinning the nonce to this binding is what lets an
                x402 payment ride asynchronous transports safely: a replayed challenge
                can't redirect funds and a signed payment can't settle twice.
            expires_at (datetime.datetime):
            payer_org (None | str | Unset): The org id bound as payer, if one was set at creation.
            resource (None | str | Unset):
            description (None | str | Unset):
            settle_tx (None | str | Unset): On-chain settlement transaction hash once settled.
            settled_at (datetime.datetime | None | Unset):
            failure_reason (None | str | Unset):
            created_at (datetime.datetime | Unset):
            payment_requirements (X402PaymentRequirements | Unset): The x402 `PaymentRequirements` the payer signs over.
                Field names are
                x402's native camelCase, preserved byte-for-byte.
     """

    id: UUID
    status: X402ChallengeStatus
    network: X402ChallengeNetwork
    asset: str
    amount: str
    pay_to: str
    nonce_binding: X402NonceBinding
    expires_at: datetime.datetime
    payer_org: None | str | Unset = UNSET
    resource: None | str | Unset = UNSET
    description: None | str | Unset = UNSET
    settle_tx: None | str | Unset = UNSET
    settled_at: datetime.datetime | None | Unset = UNSET
    failure_reason: None | str | Unset = UNSET
    created_at: datetime.datetime | Unset = UNSET
    payment_requirements: X402PaymentRequirements | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.x402_nonce_binding import X402NonceBinding
        from ..models.x402_payment_requirements import X402PaymentRequirements
        id = str(self.id)

        status = self.status.value

        network = self.network.value

        asset = self.asset

        amount = self.amount

        pay_to = self.pay_to

        nonce_binding = self.nonce_binding.to_dict()

        expires_at = self.expires_at.isoformat()

        payer_org: None | str | Unset
        if isinstance(self.payer_org, Unset):
            payer_org = UNSET
        else:
            payer_org = self.payer_org

        resource: None | str | Unset
        if isinstance(self.resource, Unset):
            resource = UNSET
        else:
            resource = self.resource

        description: None | str | Unset
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        settle_tx: None | str | Unset
        if isinstance(self.settle_tx, Unset):
            settle_tx = UNSET
        else:
            settle_tx = self.settle_tx

        settled_at: None | str | Unset
        if isinstance(self.settled_at, Unset):
            settled_at = UNSET
        elif isinstance(self.settled_at, datetime.datetime):
            settled_at = self.settled_at.isoformat()
        else:
            settled_at = self.settled_at

        failure_reason: None | str | Unset
        if isinstance(self.failure_reason, Unset):
            failure_reason = UNSET
        else:
            failure_reason = self.failure_reason

        created_at: str | Unset = UNSET
        if not isinstance(self.created_at, Unset):
            created_at = self.created_at.isoformat()

        payment_requirements: dict[str, Any] | Unset = UNSET
        if not isinstance(self.payment_requirements, Unset):
            payment_requirements = self.payment_requirements.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "status": status,
            "network": network,
            "asset": asset,
            "amount": amount,
            "pay_to": pay_to,
            "nonce_binding": nonce_binding,
            "expires_at": expires_at,
        })
        if payer_org is not UNSET:
            field_dict["payer_org"] = payer_org
        if resource is not UNSET:
            field_dict["resource"] = resource
        if description is not UNSET:
            field_dict["description"] = description
        if settle_tx is not UNSET:
            field_dict["settle_tx"] = settle_tx
        if settled_at is not UNSET:
            field_dict["settled_at"] = settled_at
        if failure_reason is not UNSET:
            field_dict["failure_reason"] = failure_reason
        if created_at is not UNSET:
            field_dict["created_at"] = created_at
        if payment_requirements is not UNSET:
            field_dict["payment_requirements"] = payment_requirements

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.x402_nonce_binding import X402NonceBinding
        from ..models.x402_payment_requirements import X402PaymentRequirements
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        status = X402ChallengeStatus(d.pop("status"))




        network = X402ChallengeNetwork(d.pop("network"))




        asset = d.pop("asset")

        amount = d.pop("amount")

        pay_to = d.pop("pay_to")

        nonce_binding = X402NonceBinding.from_dict(d.pop("nonce_binding"))




        expires_at = isoparse(d.pop("expires_at"))




        def _parse_payer_org(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        payer_org = _parse_payer_org(d.pop("payer_org", UNSET))


        def _parse_resource(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        resource = _parse_resource(d.pop("resource", UNSET))


        def _parse_description(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        description = _parse_description(d.pop("description", UNSET))


        def _parse_settle_tx(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        settle_tx = _parse_settle_tx(d.pop("settle_tx", UNSET))


        def _parse_settled_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                settled_at_type_0 = isoparse(data)



                return settled_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        settled_at = _parse_settled_at(d.pop("settled_at", UNSET))


        def _parse_failure_reason(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        failure_reason = _parse_failure_reason(d.pop("failure_reason", UNSET))


        _created_at = d.pop("created_at", UNSET)
        created_at: datetime.datetime | Unset
        if isinstance(_created_at,  Unset):
            created_at = UNSET
        else:
            created_at = isoparse(_created_at)




        _payment_requirements = d.pop("payment_requirements", UNSET)
        payment_requirements: X402PaymentRequirements | Unset
        if isinstance(_payment_requirements,  Unset):
            payment_requirements = UNSET
        else:
            payment_requirements = X402PaymentRequirements.from_dict(_payment_requirements)




        x402_challenge = cls(
            id=id,
            status=status,
            network=network,
            asset=asset,
            amount=amount,
            pay_to=pay_to,
            nonce_binding=nonce_binding,
            expires_at=expires_at,
            payer_org=payer_org,
            resource=resource,
            description=description,
            settle_tx=settle_tx,
            settled_at=settled_at,
            failure_reason=failure_reason,
            created_at=created_at,
            payment_requirements=payment_requirements,
        )


        x402_challenge.additional_properties = d
        return x402_challenge

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
