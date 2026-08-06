from enum import Enum

class OutboundStatusDomainStatus(str, Enum):
    INACTIVE = "inactive"
    PENDING_OUTBOUND_DNS = "pending_outbound_dns"
    PENDING_OWNERSHIP = "pending_ownership"
    SENDABLE = "sendable"

    def __str__(self) -> str:
        return str(self.value)
