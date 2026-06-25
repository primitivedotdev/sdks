from enum import Enum

class SimulateRouteResultMatchedTierType3Type1(str, Enum):
    EXACT = "exact"
    REGEX = "regex"
    WILDCARD = "wildcard"

    def __str__(self) -> str:
        return str(self.value)
