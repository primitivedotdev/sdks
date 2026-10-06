from enum import StrEnum

class UpdateRouteInputMatchType(StrEnum):
    EXACT = "exact"
    REGEX = "regex"
    WILDCARD = "wildcard"

    def __str__(self) -> str:
        return str(self.value)
