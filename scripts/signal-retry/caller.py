"""Runs against an installed wheel in a fresh virtual environment."""

import asyncio
import json
import os
import sys
from dataclasses import asdict
from uuid import uuid4

from primitive.api.api.sending.send_email import asyncio_detailed
from primitive.api.client import AuthenticatedClient
from primitive.api.models.send_mail_input import SendMailInput
from primitive.signals import (
    ExpiredSignal,
    PreparedSignal,
    SignalInput,
    SignalParent,
    prepare_signal_email,
    send_prepared_signal,
)

mode, record, url, clock, scope, kind = sys.argv[1:]
now = int(clock)
if mode == "prepare":
    result = prepare_signal_email(
        SignalInput(
            parent=SignalParent(
                scope,
                "owner@example.test",
                "agent@example.test",
                "<parent@example.test>",
                "Research café",
                ("<ancestor@example.test>",),
            ),
            kind=kind,
            status="received",
            expires_at_ms=now + 60000,
        ),
        uuid=lambda: str(uuid4()),
        now=lambda: now,
    )
    assert result.prepared is not None
    fd = os.open(record, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as stream:
        json.dump(asdict(result.prepared), stream)
        stream.flush()
        os.fsync(stream.fileno())
    print(json.dumps({"status": "prepared"}))
else:
    with open(record) as stream:
        prepared = PreparedSignal(**json.load(stream))

    async def attempt():
        async with AuthenticatedClient(
            base_url=url, token="local" + "-fixture"
        ) as client:

            async def adapter(body, key):
                response = await asyncio_detailed(
                    client=client,
                    body=SendMailInput.from_dict(body),
                    idempotency_key=key,
                )
                assert response.status_code == 200
                return json.loads(response.content)

            result = await send_prepared_signal(
                adapter, prepared, account_scope=scope, now=lambda: now
            )
            if isinstance(result, ExpiredSignal):
                return {"status": "expired", "idempotencyKey": result.idempotency_key}
            return {"status": "response", "result": result.result}

    print(json.dumps(asyncio.run(attempt())))
