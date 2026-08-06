from enum import Enum

class DomainDnsHealthStatus(str, Enum):
    DEGRADED = "degraded"
    HEALTHY = "healthy"
    PENDING = "pending"
    SUSPENDED = "suspended"

    def __str__(self) -> str:
        return str(self.value)
