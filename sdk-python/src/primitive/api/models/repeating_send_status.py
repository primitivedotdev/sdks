from enum import Enum

class RepeatingSendStatus(str, Enum):
    ACTIVE = "active"
    CANCELED = "canceled"
    COMPLETED = "completed"
    PAUSED = "paused"
    STOPPED_BY_RECIPIENT = "stopped_by_recipient"

    def __str__(self) -> str:
        return str(self.value)
