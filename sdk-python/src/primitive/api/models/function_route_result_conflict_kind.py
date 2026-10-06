from enum import StrEnum

class FunctionRouteResultConflictKind(StrEnum):
    FUNCTION = "function"
    HTTP = "http"

    def __str__(self) -> str:
        return str(self.value)
