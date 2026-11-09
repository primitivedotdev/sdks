from enum import StrEnum

class DecideSuspensionRequestGrantType1Preset(StrEnum):
    CUSTOM = "custom"
    OWN_ADDRESSES = "own_addresses"
    OWN_ADDRESSES_READ_ONLY = "own_addresses_read_only"
    READ_ONLY = "read_only"
    SEND_ONLY = "send_only"
    SUPER_ADMIN = "super_admin"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "DecideSuspensionRequestGrantType1Preset | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
