from enum import Enum

class RecipientRouteMatchType(str, Enum):
    EXACT = "exact"
    REGEX = "regex"
    WILDCARD = "wildcard"

    def __str__(self) -> str:
        return str(self.value)
