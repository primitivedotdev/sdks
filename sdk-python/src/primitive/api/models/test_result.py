from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.test_result_delivery_type_0 import TestResultDeliveryType0





T = TypeVar("T", bound="TestResult")



@_attrs_define
class TestResult:
    """ 
        Attributes:
            status (int): HTTP status code returned by the endpoint
            body (None | str): The receiver response text, only with organization-wide mail.raw:read. Null without that
                access because a receiver can echo a raw download link.
            reachable (bool): Whether the endpoint answered the test with a 2xx status: the request reached it and its
                handler accepted it. It says nothing about whether real mail is sent to it: see delivery.
            delivery (None | TestResultDeliveryType0): Whether real email.received events would be sent to this endpoint,
                judged by the endpoint's own conditions as delivery judges them. Null when that could not be checked just now.
            signature (str | Unset): The signature header value sent, answered to a caller who may see it: for a webhook
                signed with the organization's secret, a caller who may read that secret; for one signed with its own, the
                person who owns it, calling as themselves.
     """

    status: int
    body: None | str
    reachable: bool
    delivery: None | TestResultDeliveryType0
    signature: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.test_result_delivery_type_0 import TestResultDeliveryType0 # noqa: PLC0415
        status = self.status

        body: None | str
        body = self.body

        reachable = self.reachable

        delivery: dict[str, Any] | None
        if isinstance(self.delivery, TestResultDeliveryType0):
            delivery = self.delivery.to_dict()
        else:
            delivery = self.delivery

        signature = self.signature


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "status": status,
            "body": body,
            "reachable": reachable,
            "delivery": delivery,
        })
        if signature is not UNSET:
            field_dict["signature"] = signature

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.test_result_delivery_type_0 import TestResultDeliveryType0 # noqa: PLC0415
        d = dict(src_dict)
        status = d.pop("status")

        def _parse_body(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        body = _parse_body(d.pop("body"))


        reachable = d.pop("reachable")

        def _parse_delivery(data: object) -> None | TestResultDeliveryType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                delivery_type_0 = TestResultDeliveryType0.from_dict(data)



                return delivery_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | TestResultDeliveryType0, data)

        delivery = _parse_delivery(d.pop("delivery"))


        signature = d.pop("signature", UNSET)

        test_result = cls(
            status=status,
            body=body,
            reachable=reachable,
            delivery=delivery,
            signature=signature,
        )


        test_result.additional_properties = d
        return test_result

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
