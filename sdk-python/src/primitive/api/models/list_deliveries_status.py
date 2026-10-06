from enum import StrEnum

class ListDeliveriesStatus(StrEnum):
    DELIVERED = "delivered"
    FAILED = "failed"
    HEADER_CONFIRMED = "header_confirmed"
    PENDING = "pending"

    def __str__(self) -> str:
        return str(self.value)
