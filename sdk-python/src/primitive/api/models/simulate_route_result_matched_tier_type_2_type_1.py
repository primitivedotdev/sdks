from enum import StrEnum

class SimulateRouteResultMatchedTierType2Type1(StrEnum):
    EXACT = "exact"
    REGEX = "regex"
    WILDCARD = "wildcard"

    def __str__(self) -> str:
        return str(self.value)
