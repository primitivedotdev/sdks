from enum import StrEnum

class SendPermissionManagedZoneType(StrEnum):
    MANAGED_ZONE = "managed_zone"

    def __str__(self) -> str:
        return str(self.value)
