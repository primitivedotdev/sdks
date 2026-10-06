from enum import StrEnum

class SendPermissionAddressType(StrEnum):
    ADDRESS = "address"

    def __str__(self) -> str:
        return str(self.value)
