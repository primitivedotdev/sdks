from enum import Enum

class EmailDetailWebhookStatusType1(str, Enum):
    EXHAUSTED = "exhausted"
    FAILED = "failed"
    FIRED = "fired"
    IN_FLIGHT = "in_flight"
    PENDING = "pending"

    def __str__(self) -> str:
        return str(self.value)
