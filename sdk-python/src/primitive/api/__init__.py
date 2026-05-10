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

# Default production hosts. Two-host split exists because /send-mail
# needs a larger body cap than Vercel allows; host 2 is a Cloudflare
# Worker that accepts ~30 MiB raw. Host 1 carries everything else.
# Customers don't see this split: PrimitiveClient.send() always routes
# to host 2 internally, every other operation routes to host 1.
#
# Both base URLs are independently overridable via PrimitiveClient
# constructor options. Override is for internal staging/local testing;
# not part of the publicly-supported surface.
DEFAULT_API_BASE_URL_1 = "https://www.primitive.dev/api/v1"
DEFAULT_API_BASE_URL_2 = "https://api.primitive.dev/v1"

# Back-compat alias for the primary host. Prefer DEFAULT_API_BASE_URL_1
# in new code.
DEFAULT_BASE_URL = DEFAULT_API_BASE_URL_1


def create_client(
    api_key: str,
    base_url: str = DEFAULT_API_BASE_URL_1,
) -> AuthenticatedClient:
    return AuthenticatedClient(base_url=base_url, token=api_key)


__all__ = [
    "AuthenticatedClient",
    "Client",
    "DEFAULT_API_BASE_URL_1",
    "DEFAULT_API_BASE_URL_2",
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
