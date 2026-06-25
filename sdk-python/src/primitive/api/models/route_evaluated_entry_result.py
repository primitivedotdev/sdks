from enum import Enum

class RouteEvaluatedEntryResult(str, Enum):
    ERROR = "error"
    HIT = "hit"
    MISS = "miss"
    SKIPPED = "skipped"

    def __str__(self) -> str:
        return str(self.value)
