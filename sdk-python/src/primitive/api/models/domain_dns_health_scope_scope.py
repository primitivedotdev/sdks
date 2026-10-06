from enum import StrEnum

class DomainDnsHealthScopeScope(StrEnum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"
    OWNERSHIP = "ownership"

    def __str__(self) -> str:
        return str(self.value)
