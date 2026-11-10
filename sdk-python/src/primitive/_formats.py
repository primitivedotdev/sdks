"""Format checks for the webhook JSON schemas.

The patterns are the ones the Node SDK's generated validator uses
(``DATE_TIME_RE`` and ``URI_RE`` in ``sdk-node/scripts/validator-ajv.ts``), so
the email and sent_email schema checks refuse the same ``date-time`` and
``uri`` values in both SDKs without jsonschema's optional format packages. A
test keeps the two copies in step.
"""

from __future__ import annotations

import re
from collections.abc import Callable

from jsonschema import FormatChecker

# RFC 3339 date-time pattern: YYYY-MM-DDThh:mm:ss[.frac](Z|+hh:mm|-hh:mm)
DATE_TIME_PATTERN = r"^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])[T\t ](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:[Zz]|[+-](?:[01]\d|2[0-3]):?[0-5]\d)$"

# RFC 3986 URI pattern (from ajv-formats), matched case-insensitively
URI_PATTERN = r"^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$"

# re.ASCII keeps \d to 0-9 and case folding to ASCII letters, as in a
# JavaScript regex without the u flag.
_DATE_TIME_RE = re.compile(DATE_TIME_PATTERN, re.ASCII)
_URI_RE = re.compile(URI_PATTERN, re.ASCII | re.IGNORECASE)


def is_date_time(value: str) -> bool:
    # fullmatch, not search: Python's $ also matches before a trailing
    # newline, JavaScript's does not.
    return _DATE_TIME_RE.fullmatch(value) is not None


def is_uri(value: str) -> bool:
    return _URI_RE.fullmatch(value) is not None


def _strings_only(check: Callable[[str], bool]) -> Callable[[object], bool]:
    # A format applies to strings; the schema's type keyword covers the rest.
    def check_instance(instance: object) -> bool:
        return not isinstance(instance, str) or check(instance)

    return check_instance


def webhook_format_checker() -> FormatChecker:
    """A format checker for the webhook schemas: ``date-time`` and ``uri``."""
    checker = FormatChecker(formats=())
    checker.checks("date-time")(_strings_only(is_date_time))
    checker.checks("uri")(_strings_only(is_uri))
    return checker
