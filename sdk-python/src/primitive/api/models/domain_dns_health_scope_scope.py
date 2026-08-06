from enum import Enum

class DomainDnsHealthScopeScope(str, Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"
    OWNERSHIP = "ownership"

    def __str__(self) -> str:
        return str(self.value)
