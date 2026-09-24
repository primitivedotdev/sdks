"""Decoding of the credit balance and redemption responses."""

from datetime import datetime

from primitive.api.models.credit_balance import CreditBalance
from primitive.api.models.credit_redemption import CreditRedemption
from primitive.api.types import Unset


def test_balance_accepts_null_budget_and_null_prepaid_credit() -> None:
    balance = CreditBalance.from_dict({"budget": None, "prepaid_credit": None})
    assert balance.budget is None
    assert balance.prepaid_credit is None


def test_balance_leaves_omitted_prepaid_credit_unset() -> None:
    balance = CreditBalance.from_dict({"budget": None})
    assert isinstance(balance.prepaid_credit, Unset)


def test_balance_decodes_budget_and_prepaid_credit() -> None:
    balance = CreditBalance.from_dict(
        {
            "budget": {
                "currency": "usd",
                "max_amount_micros": "20000000",
                "spent_micros": "4500000",
                "remaining_micros": "15500000",
                "per_topup_cap_micros": None,
                "expires_at": "2026-12-31T00:00:00.000Z",
                "status": "active",
            },
            "prepaid_credit": {
                "currency": "usd",
                "remaining_micros": "4200000",
                "next_expires_at": None,
            },
        }
    )
    assert balance.budget is not None
    assert balance.budget.remaining_micros == "15500000"
    assert isinstance(balance.budget.expires_at, datetime)
    assert balance.budget.per_topup_cap_micros is None
    assert not isinstance(balance.prepaid_credit, Unset)
    assert balance.prepaid_credit is not None
    assert balance.prepaid_credit.next_expires_at is None


def test_redemption_decodes_nullable_expiry_and_label() -> None:
    redemption = CreditRedemption.from_dict(
        {
            "redemption_id": "red_1",
            "amount_micros": "50000000",
            "currency": "usd",
            "granted_at": "2026-09-23T17:00:00.000Z",
            "expires_at": None,
            "label": None,
            "replayed": False,
            "message": "$50.00 in credits added. Never expires. Applies to usage from now on.",
        }
    )
    assert redemption.expires_at is None
    assert redemption.label is None
    assert isinstance(redemption.granted_at, datetime)
