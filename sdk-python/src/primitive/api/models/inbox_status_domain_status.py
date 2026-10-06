from enum import StrEnum

class InboxStatusDomainStatus(StrEnum):
    INACTIVE = "inactive"
    PENDING_DNS = "pending_dns"
    READY = "ready"
    STORED_ONLY = "stored_only"

    def __str__(self) -> str:
        return str(self.value)
