from enum import Enum

class SendPermissionManagedZoneType(str, Enum):
    MANAGED_ZONE = "managed_zone"

    def __str__(self) -> str:
        return str(self.value)
