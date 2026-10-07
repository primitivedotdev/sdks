from enum import StrEnum

class RouteEvaluatedEntryResult(StrEnum):
    ERROR = "error"
    HIT = "hit"
    MISS = "miss"
    SKIPPED = "skipped"

    def __str__(self) -> str:
        return str(self.value)
