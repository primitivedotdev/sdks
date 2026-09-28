# Contacts in the CLI

The organization directory stores shared addresses and display names. Each agent has separate memberships, purposes, and notification preferences. Contact changes do not send email.

```sh
primitive contacts list --limit 50
primitive contacts get peer@example.com
primitive contacts add peer@example.com --name "Project collaborator"
primitive contacts update peer@example.com --name "New display name"
primitive contacts update peer@example.com --clear-name
primitive contacts remove peer@example.com
```

`add` uses `if_absent` and never overwrites a shared label. Adding an existing address without `--name` returns the existing contact unchanged. A conflicting supplied name produces an error; use `update` to change it. Connected-agent credentials can create address-only directory entries but cannot change shared names or remove directory entries.

Each list prints one JSON page, including `data` and `meta.cursor`. A null cursor means the last page. Pass a non-null cursor back with `--cursor` to continue. Pages reflect current state rather than a frozen snapshot.

## Agent memberships

With a selected connected-agent profile, `--agent` defaults to that profile's own address. An alternate address is rejected. With organization credentials, specify `--agent` explicitly.

```sh
primitive agent contacts list --agent agent@example.com
primitive agent contacts add peer@example.com --agent agent@example.com --purpose "Project questions"
primitive agent contacts update peer@example.com --agent agent@example.com --notify
primitive agent contacts update peer@example.com --agent agent@example.com --no-notify
primitive agent contacts update peer@example.com --agent agent@example.com --clear-purpose
primitive agent contacts remove peer@example.com --agent agent@example.com
```

Agent `add` ensures an address-only directory entry exists, preserving its shared label, then creates an absent membership. If membership creation fails, the directory entry remains available and the command reports the partial outcome. It does not report a saved membership or roll back the directory entry.

New memberships default to notifications off. Omitted flags leave existing preferences unchanged. `--notify` opts this agent into notifications from the contact; `--no-notify` disables them. The API manages activation timestamps and generations. Saving a preference does not start notifications: a running receiver must be configured to use saved contacts. Explicit reply waits are independent.

Removing an agent membership preserves the directory entry and other agents' memberships. Removing an organization contact also removes its memberships. Neither operation deletes mail or an agent identity.

## Concurrent changes

Updates and removals read the current version and perform one conditional write. Membership lookup follows pages until it finds the exact contact. It stops without writing if a page is incomplete or pagination repeats.

For automation, pass the exact `version` from a prior response with `--if-version` to update or remove. The CLI never replaces a stale version or retries a conflict with a newer version. On a conflict, inspect the current row and decide whether your change still applies.

```sh
primitive agent contacts update peer@example.com --agent agent@example.com --notify --if-version "$CONTACT_VERSION"
primitive contacts remove peer@example.com --if-version "$CONTACT_VERSION"
```

The bare `primitive contacts` and `primitive agent contacts` commands show help.
