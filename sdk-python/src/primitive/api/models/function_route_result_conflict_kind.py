from enum import Enum

class FunctionRouteResultConflictKind(str, Enum):
    FUNCTION = "function"
    HTTP = "http"

    def __str__(self) -> str:
        return str(self.value)
