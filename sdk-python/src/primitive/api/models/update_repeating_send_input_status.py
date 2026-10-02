from enum import Enum

class UpdateRepeatingSendInputStatus(str, Enum):
    ACTIVE = "active"
    CANCELED = "canceled"
    PAUSED = "paused"

    def __str__(self) -> str:
        return str(self.value)
