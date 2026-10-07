from enum import StrEnum

class FunctionRouteBodyTargetType1Kind(StrEnum):
    FALLBACK = "fallback"

    def __str__(self) -> str:
        return str(self.value)
