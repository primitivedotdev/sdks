from enum import Enum

class UpdateRepeatingSendRequestStatus(str, Enum):
    ACTIVE = "active"
    CANCELED = "canceled"
    PAUSED = "paused"

    def __str__(self) -> str:
        return str(self.value)
