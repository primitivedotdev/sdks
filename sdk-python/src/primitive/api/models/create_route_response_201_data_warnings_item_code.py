from enum import StrEnum

class CreateRouteResponse201DataWarningsItemCode(StrEnum):
    ENDPOINT_OWNER_LIMITED = "endpoint_owner_limited"
    OWNER_UNCHECKED = "owner_unchecked"
    ROUTE_OWNER_LIMITED = "route_owner_limited"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "CreateRouteResponse201DataWarningsItemCode | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
