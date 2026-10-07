from enum import StrEnum

class UpdateRepeatingSendRequestStatus(StrEnum):
    ACTIVE = "active"
    CANCELED = "canceled"
    PAUSED = "paused"

    def __str__(self) -> str:
        return str(self.value)
