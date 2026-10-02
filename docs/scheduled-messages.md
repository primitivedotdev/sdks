# Scheduled messages to agents

An org member can schedule a recurring message to one of the org's connected
agents. The messages are ordinary email from the member's personal address to
the agent, sent every `interval_minutes` in one thread. With `idle_minutes` set,
a due message is skipped while the agent has sent mail within that many minutes.

## Interactions

Each scheduled message carries an `interaction.json` part:

| Field | Value |
|---|---|
| `protocol` | `schedule.tick` |
| `protocol_version` | `1` |
| `step` | `tick` |
| `payload.schedule_id` | schedule UUID |
| `payload.sequence` | 1 for the first message, then one higher per message |
| `payload.interval_minutes` | 5 to 10080 |
| `payload.idle_minutes` | 1 to 10080, or null |
| `payload.agent_can_stop` | whether the agent may stop the schedule |

When the agent stops a schedule, the server replies in the thread from the
agent to the owner with a `schedule.stop` (version 1, step `stop`) part whose
payload is `{"reason": "..."}`, or `{}` without a reason. The reason is
agent-written text of at most 280 UTF-16 code units.

Hand-built `schedule.stop` mail is not interpreted. Only the stop endpoint stops
a schedule.

## Stopping a schedule as the agent

`POST /v1/emails/{id}/schedule-stop` with `{"reason": "..."}` (optional), using
the agent's own connected credential. `{id}` is the agent's received copy of any
message of the schedule. A repeat call on a schedule the agent already stopped
returns the same result without a second reply.

- CLI: `primitive schedule stop --id <email-id> [--reason "..."]`
- Node: `client.schedules.stop(emailId, { reason })`

## Parsing helpers

The helpers parse and build data only; they make no requests and establish no
identity. Read an interaction only from mail that authenticates as the expected
sender.

| Node (`@primitivedotdev/sdk/interactions`) | Python (`primitive.schedules`) | Go |
|---|---|---|
| `parseScheduleTick(bytes)` | `parse_schedule_tick(bytes)` | `ParseScheduleTick` |
| `readScheduleTick(envelope)` | `read_schedule_tick(envelope)` | `ReadScheduleTick` |
| `parseScheduleStop(bytes)` | `parse_schedule_stop(bytes)` | `ParseScheduleStop` |
| `readScheduleStop(envelope)` | `read_schedule_stop(envelope)` | `ReadScheduleStop` |
| `buildScheduleStopBody({ reason })` | `build_schedule_stop_body(reason)` | `BuildScheduleStopBody` |
| `scheduleStopCommand(emailId)` | `schedule_stop_command(email_id)` | `ScheduleStopCommand` |

Parse results have status `valid`, `other` (a valid envelope of a different
protocol or version) or `invalid` (`invalid_envelope`, `invalid_step` or
`invalid_payload`).
`test-fixtures/schedule-interactions.json` holds the shared cases all three SDKs
run.
