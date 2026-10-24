from enum import StrEnum

class CliOrgRefusalReason(StrEnum):
    CLI_ACCESS_DISABLED_BY_ORG = "cli_access_disabled_by_org"
    CLI_ACCESS_REVOKED = "cli_access_revoked"
    NOT_A_MEMBER = "not_a_member"
    ROLE_INSUFFICIENT = "role_insufficient"

    def __str__(self) -> str:
        return str(self.value)
