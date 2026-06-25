from enum import Enum

class SimulateRouteResultMatchedTierType1(str, Enum):
    EXACT = "exact"
    REGEX = "regex"
    WILDCARD = "wildcard"

    def __str__(self) -> str:
        return str(self.value)
