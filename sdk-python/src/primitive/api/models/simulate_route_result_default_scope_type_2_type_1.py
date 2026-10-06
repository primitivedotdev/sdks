from enum import StrEnum

class SimulateRouteResultDefaultScopeType2Type1(StrEnum):
    DOMAIN = "domain"
    ORG = "org"

    def __str__(self) -> str:
        return str(self.value)
