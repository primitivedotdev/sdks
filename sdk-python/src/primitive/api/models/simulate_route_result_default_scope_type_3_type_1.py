from enum import Enum

class SimulateRouteResultDefaultScopeType3Type1(str, Enum):
    DOMAIN = "domain"
    ORG = "org"

    def __str__(self) -> str:
        return str(self.value)
