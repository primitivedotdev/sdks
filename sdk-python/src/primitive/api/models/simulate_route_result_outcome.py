from enum import StrEnum

class SimulateRouteResultOutcome(StrEnum):
    DEFAULTED = "defaulted"
    MATCHED = "matched"
    NONE = "none"

    def __str__(self) -> str:
        return str(self.value)
