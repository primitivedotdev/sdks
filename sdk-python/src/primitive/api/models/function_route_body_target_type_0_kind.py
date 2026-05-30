from enum import Enum

class FunctionRouteBodyTargetType0Kind(str, Enum):
    DOMAIN = "domain"

    def __str__(self) -> str:
        return str(self.value)
