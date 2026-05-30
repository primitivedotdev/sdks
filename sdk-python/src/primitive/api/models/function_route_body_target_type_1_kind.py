from enum import Enum

class FunctionRouteBodyTargetType1Kind(str, Enum):
    FALLBACK = "fallback"

    def __str__(self) -> str:
        return str(self.value)
