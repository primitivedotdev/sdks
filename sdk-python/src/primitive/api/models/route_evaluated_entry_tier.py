from enum import Enum

class RouteEvaluatedEntryTier(str, Enum):
    EXACT = "exact"
    REGEX = "regex"
    WILDCARD = "wildcard"

    def __str__(self) -> str:
        return str(self.value)
