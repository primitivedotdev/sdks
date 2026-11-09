from enum import StrEnum

class ListDeliveriesStatus(StrEnum):
    DELIVERED = "delivered"
    DISCARDED = "discarded"
    FAILED = "failed"
    HEADER_CONFIRMED = "header_confirmed"
    HELD = "held"
    PENDING = "pending"
    SKIPPED_BY_RULES = "skipped_by_rules"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "ListDeliveriesStatus | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
