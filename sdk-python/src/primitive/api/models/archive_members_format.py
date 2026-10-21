from enum import StrEnum

class ArchiveMembersFormat(StrEnum):
    TAR = "tar"
    TAR_GZ = "tar.gz"
    ZIP = "zip"

    def __str__(self) -> str:
        return str(self.value)
