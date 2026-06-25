from enum import Enum

class SimulateRouteResultOutcome(str, Enum):
    DEFAULTED = "defaulted"
    MATCHED = "matched"
    NONE = "none"

    def __str__(self) -> str:
        return str(self.value)
