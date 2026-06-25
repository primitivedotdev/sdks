from enum import Enum

class SimulateRouteResultDefaultScope(str, Enum):
    DOMAIN = "domain"
    ORG = "org"

    def __str__(self) -> str:
        return str(self.value)
