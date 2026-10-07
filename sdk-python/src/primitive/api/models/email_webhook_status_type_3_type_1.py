from enum import StrEnum

class EmailWebhookStatusType3Type1(StrEnum):
    EXHAUSTED = "exhausted"
    FAILED = "failed"
    FIRED = "fired"
    IN_FLIGHT = "in_flight"
    PENDING = "pending"

    def __str__(self) -> str:
        return str(self.value)
