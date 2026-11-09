from enum import StrEnum

class CliOrgRefusalReason(StrEnum):
    CLI_ACCESS_DISABLED_BY_ORG = "cli_access_disabled_by_org"
    CLI_ACCESS_REVOKED = "cli_access_revoked"
    NOT_A_MEMBER = "not_a_member"
    ROLE_INSUFFICIENT = "role_insufficient"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "CliOrgRefusalReason | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
