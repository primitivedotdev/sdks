from . import api, models
from .client import AuthenticatedClient, Client
from .downloads import (
    adownload_attachments,
    adownload_attachments_detailed,
    adownload_raw_email,
    adownload_raw_email_detailed,
    download_attachments,
    download_attachments_detailed,
    download_raw_email,
    download_raw_email_detailed,
)
from .errors import UnexpectedStatus
from .types import UNSET, File, Response, Unset

DEFAULT_BASE_URL = "https://www.primitive.dev/api/v1"


def create_client(
    api_key: str,
    base_url: str = DEFAULT_BASE_URL,
) -> AuthenticatedClient:
    return AuthenticatedClient(base_url=base_url, token=api_key)


__all__ = [
    "AuthenticatedClient",
    "Client",
    "DEFAULT_BASE_URL",
    "File",
    "Response",
    "UNSET",
    "Unset",
    "UnexpectedStatus",
    "adownload_attachments",
    "adownload_attachments_detailed",
    "adownload_raw_email",
    "adownload_raw_email_detailed",
    "api",
    "create_client",
    "download_attachments",
    "download_attachments_detailed",
    "download_raw_email",
    "download_raw_email_detailed",
    "models",
]
