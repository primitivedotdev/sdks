from enum import Enum

class SendPermissionAddressType(str, Enum):
    ADDRESS = "address"

    def __str__(self) -> str:
        return str(self.value)
