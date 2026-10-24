from enum import StrEnum

class KeyPreset(StrEnum):
    CUSTOM = "custom"
    OWN_ADDRESSES = "own_addresses"
    OWN_ADDRESSES_READ_ONLY = "own_addresses_read_only"
    READ_ONLY = "read_only"
    SEND_ONLY = "send_only"
    SUPER_ADMIN = "super_admin"

    def __str__(self) -> str:
        return str(self.value)
