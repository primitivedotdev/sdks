from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="Account")



@_attrs_define
class Account:
    """ 
        Attributes:
            id (UUID):
            email (str):
            plan (str):
            created_at (datetime.datetime):
            discard_content_on_webhook_confirmed (bool):
            onboarding_completed (bool | Unset):
            onboarding_step (None | str | Unset):
            stripe_subscription_status (None | str | Unset):
            subscription_current_period_end (datetime.datetime | None | Unset):
            subscription_cancel_at_period_end (bool | None | Unset):
            spam_threshold (float | None | Unset):
            webhook_secret_rotated_at (datetime.datetime | None | Unset):
     """

    id: UUID
    email: str
    plan: str
    created_at: datetime.datetime
    discard_content_on_webhook_confirmed: bool
    onboarding_completed: bool | Unset = UNSET
    onboarding_step: None | str | Unset = UNSET
    stripe_subscription_status: None | str | Unset = UNSET
    subscription_current_period_end: datetime.datetime | None | Unset = UNSET
    subscription_cancel_at_period_end: bool | None | Unset = UNSET
    spam_threshold: float | None | Unset = UNSET
    webhook_secret_rotated_at: datetime.datetime | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        email = self.email

        plan = self.plan

        created_at = self.created_at.isoformat()

        discard_content_on_webhook_confirmed = self.discard_content_on_webhook_confirmed

        onboarding_completed = self.onboarding_completed

        onboarding_step: None | str | Unset
        if isinstance(self.onboarding_step, Unset):
            onboarding_step = UNSET
        else:
            onboarding_step = self.onboarding_step

        stripe_subscription_status: None | str | Unset
        if isinstance(self.stripe_subscription_status, Unset):
            stripe_subscription_status = UNSET
        else:
            stripe_subscription_status = self.stripe_subscription_status

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
            "created_at": created_at,
            "discard_content_on_webhook_confirmed": discard_content_on_webhook_confirmed,
        })
        if onboarding_completed is not UNSET:
            field_dict["onboarding_completed"] = onboarding_completed
        if onboarding_step is not UNSET:
            field_dict["onboarding_step"] = onboarding_step
        if stripe_subscription_status is not UNSET:
            field_dict["stripe_subscription_status"] = stripe_subscription_status
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
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        email = d.pop("email")

        plan = d.pop("plan")

        created_at = isoparse(d.pop("created_at"))




        discard_content_on_webhook_confirmed = d.pop("discard_content_on_webhook_confirmed")

        onboarding_completed = d.pop("onboarding_completed", UNSET)

        def _parse_onboarding_step(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        onboarding_step = _parse_onboarding_step(d.pop("onboarding_step", UNSET))


        def _parse_stripe_subscription_status(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        stripe_subscription_status = _parse_stripe_subscription_status(d.pop("stripe_subscription_status", UNSET))


        def _parse_subscription_current_period_end(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                subscription_current_period_end_type_0 = isoparse(data)



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
                webhook_secret_rotated_at_type_0 = isoparse(data)



                return webhook_secret_rotated_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        webhook_secret_rotated_at = _parse_webhook_secret_rotated_at(d.pop("webhook_secret_rotated_at", UNSET))


        account = cls(
            id=id,
            email=email,
            plan=plan,
            created_at=created_at,
            discard_content_on_webhook_confirmed=discard_content_on_webhook_confirmed,
            onboarding_completed=onboarding_completed,
            onboarding_step=onboarding_step,
            stripe_subscription_status=stripe_subscription_status,
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
