from enum import Enum

class DeliveryStatus(str, Enum):
    BOUNCED = "bounced"
    DEFERRED = "deferred"
    DELIVERED = "delivered"
    WAIT_TIMEOUT = "wait_timeout"

    def __str__(self) -> str:
        return str(self.value)
