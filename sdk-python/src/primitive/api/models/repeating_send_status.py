from enum import StrEnum

class RepeatingSendStatus(StrEnum):
    ACTIVE = "active"
    CANCELED = "canceled"
    COMPLETED = "completed"
    PAUSED = "paused"
    STOPPED_BY_RECIPIENT = "stopped_by_recipient"

    def __str__(self) -> str:
        return str(self.value)
