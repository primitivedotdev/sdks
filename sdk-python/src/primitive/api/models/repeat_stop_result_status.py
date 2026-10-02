from enum import Enum

class RepeatStopResultStatus(str, Enum):
    STOPPED_BY_RECIPIENT = "stopped_by_recipient"

    def __str__(self) -> str:
        return str(self.value)
