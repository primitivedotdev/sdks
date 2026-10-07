from enum import StrEnum

class RepeatStopResultStatus(StrEnum):
    STOPPED_BY_RECIPIENT = "stopped_by_recipient"

    def __str__(self) -> str:
        return str(self.value)
