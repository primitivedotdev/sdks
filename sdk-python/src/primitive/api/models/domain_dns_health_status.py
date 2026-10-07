from enum import StrEnum

class DomainDnsHealthStatus(StrEnum):
    DEGRADED = "degraded"
    HEALTHY = "healthy"
    PENDING = "pending"
    SUSPENDED = "suspended"

    def __str__(self) -> str:
        return str(self.value)
