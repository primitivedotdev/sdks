from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.plan_limits import PlanLimits





T = TypeVar("T", bound="Account")



@_attrs_define
class Account:
    """ 
        Attributes:
            id (UUID):
            email (None | str): The signup email of the person who opened the account. Null when your credential may not see
                it: it is shown to a caller that may read the organization's members' emails, and to that person signed in as
                themself. Also null when the account has none.
            plan (str):
            limits (None | PlanLimits): Null when your credential does not hold org:read.
            entitlements (list[str] | None): Granted org entitlement keys (sorted). A headless caller reads its
                capabilities here - e.g. an emailless agent seeing only
                ["send_mail", "send_to_known_addresses"] knows it is reply-only. Null when your credential does not hold
                org:read.
            managed_inbox_address (None | str): The managed inbox FQDN to reply as, or null if the org has no managed inbox.
            created_at (datetime.datetime):
            discard_content_on_webhook_confirmed (bool):
            onboarding_completed (bool | Unset):
            onboarding_step (None | str | Unset):
            subscription_current_period_end (datetime.datetime | None | Unset):
            subscription_cancel_at_period_end (bool | None | Unset):
            spam_threshold (float | None | Unset):
            webhook_secret_rotated_at (datetime.datetime | None | Unset):
     """

    id: UUID
    email: None | str
    plan: str
    limits: None | PlanLimits
    entitlements: list[str] | None
    managed_inbox_address: None | str
    created_at: datetime.datetime
    discard_content_on_webhook_confirmed: bool
    onboarding_completed: bool | Unset = UNSET
    onboarding_step: None | str | Unset = UNSET
    subscription_current_period_end: datetime.datetime | None | Unset = UNSET
    subscription_cancel_at_period_end: bool | None | Unset = UNSET
    spam_threshold: float | None | Unset = UNSET
    webhook_secret_rotated_at: datetime.datetime | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.plan_limits import PlanLimits # noqa: PLC0415
        id = str(self.id)

        email: None | str
        email = self.email

        plan = self.plan

        limits: dict[str, Any] | None
        if isinstance(self.limits, PlanLimits):
            limits = self.limits.to_dict()
        else:
            limits = self.limits

        entitlements: list[str] | None
        if isinstance(self.entitlements, list):
            entitlements = self.entitlements


        else:
            entitlements = self.entitlements

        managed_inbox_address: None | str
        managed_inbox_address = self.managed_inbox_address

        created_at = self.created_at.isoformat()

        discard_content_on_webhook_confirmed = self.discard_content_on_webhook_confirmed

        onboarding_completed = self.onboarding_completed

        onboarding_step: None | str | Unset
        if isinstance(self.onboarding_step, Unset):
            onboarding_step = UNSET
        else:
            onboarding_step = self.onboarding_step

        subscription_current_period_end: None | str | Unset
        if isinstance(self.subscription_current_period_end, Unset):
            subscription_current_period_end = UNSET
        elif isinstance(self.subscription_current_period_end, datetime.datetime):
            subscription_current_period_end = self.subscription_current_period_end.isoformat()
        else:
            subscription_current_period_end = self.subscription_current_period_end

        subscription_cancel_at_period_end: bool | None | Unset
        if isinstance(self.subscription_cancel_at_period_end, Unset):
            subscription_cancel_at_period_end = UNSET
        else:
            subscription_cancel_at_period_end = self.subscription_cancel_at_period_end

        spam_threshold: float | None | Unset
        if isinstance(self.spam_threshold, Unset):
            spam_threshold = UNSET
        else:
            spam_threshold = self.spam_threshold

        webhook_secret_rotated_at: None | str | Unset
        if isinstance(self.webhook_secret_rotated_at, Unset):
            webhook_secret_rotated_at = UNSET
        elif isinstance(self.webhook_secret_rotated_at, datetime.datetime):
            webhook_secret_rotated_at = self.webhook_secret_rotated_at.isoformat()
        else:
            webhook_secret_rotated_at = self.webhook_secret_rotated_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "email": email,
            "plan": plan,
            "limits": limits,
            "entitlements": entitlements,
            "managed_inbox_address": managed_inbox_address,
            "created_at": created_at,
            "discard_content_on_webhook_confirmed": discard_content_on_webhook_confirmed,
        })
        if onboarding_completed is not UNSET:
            field_dict["onboarding_completed"] = onboarding_completed
        if onboarding_step is not UNSET:
            field_dict["onboarding_step"] = onboarding_step
        if subscription_current_period_end is not UNSET:
            field_dict["subscription_current_period_end"] = subscription_current_period_end
        if subscription_cancel_at_period_end is not UNSET:
            field_dict["subscription_cancel_at_period_end"] = subscription_cancel_at_period_end
        if spam_threshold is not UNSET:
            field_dict["spam_threshold"] = spam_threshold
        if webhook_secret_rotated_at is not UNSET:
            field_dict["webhook_secret_rotated_at"] = webhook_secret_rotated_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.plan_limits import PlanLimits # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        def _parse_email(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        email = _parse_email(d.pop("email"))


        plan = d.pop("plan")

        def _parse_limits(data: object) -> None | PlanLimits:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                limits_type_1 = PlanLimits.from_dict(data)



                return limits_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PlanLimits, data)

        limits = _parse_limits(d.pop("limits"))


        def _parse_entitlements(data: object) -> list[str] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                entitlements_type_0 = cast(list[str], data)

                return entitlements_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None, data)

        entitlements = _parse_entitlements(d.pop("entitlements"))


        def _parse_managed_inbox_address(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        managed_inbox_address = _parse_managed_inbox_address(d.pop("managed_inbox_address"))


        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        discard_content_on_webhook_confirmed = d.pop("discard_content_on_webhook_confirmed")

        onboarding_completed = d.pop("onboarding_completed", UNSET)

        def _parse_onboarding_step(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        onboarding_step = _parse_onboarding_step(d.pop("onboarding_step", UNSET))


        def _parse_subscription_current_period_end(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                subscription_current_period_end_type_0 = datetime.datetime.fromisoformat(data)



                return subscription_current_period_end_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        subscription_current_period_end = _parse_subscription_current_period_end(d.pop("subscription_current_period_end", UNSET))


        def _parse_subscription_cancel_at_period_end(data: object) -> bool | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(bool | None | Unset, data)

        subscription_cancel_at_period_end = _parse_subscription_cancel_at_period_end(d.pop("subscription_cancel_at_period_end", UNSET))


        def _parse_spam_threshold(data: object) -> float | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(float | None | Unset, data)

        spam_threshold = _parse_spam_threshold(d.pop("spam_threshold", UNSET))


        def _parse_webhook_secret_rotated_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                webhook_secret_rotated_at_type_0 = datetime.datetime.fromisoformat(data)



                return webhook_secret_rotated_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        webhook_secret_rotated_at = _parse_webhook_secret_rotated_at(d.pop("webhook_secret_rotated_at", UNSET))


        account = cls(
            id=id,
            email=email,
            plan=plan,
            limits=limits,
            entitlements=entitlements,
            managed_inbox_address=managed_inbox_address,
            created_at=created_at,
            discard_content_on_webhook_confirmed=discard_content_on_webhook_confirmed,
            onboarding_completed=onboarding_completed,
            onboarding_step=onboarding_step,
            subscription_current_period_end=subscription_current_period_end,
            subscription_cancel_at_period_end=subscription_cancel_at_period_end,
            spam_threshold=spam_threshold,
            webhook_secret_rotated_at=webhook_secret_rotated_at,
        )


        account.additional_properties = d
        return account

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
