from enum import StrEnum

class DeliveryStatus(StrEnum):
    BOUNCED = "bounced"
    DEFERRED = "deferred"
    DELIVERED = "delivered"
    WAIT_TIMEOUT = "wait_timeout"

    def __str__(self) -> str:
        return str(self.value)
