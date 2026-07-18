#[path = "../src/manifest.rs"]
pub mod manifest;

#[path = "../src/help_commands.rs"]
pub mod help_commands;

use help_commands::{
    expected_command_ids, expected_command_invocations, expected_command_surface,
    known_friendly_commands, known_hidden_friendly_commands, operation_ids, CommandSource,
};
use std::collections::BTreeSet;

fn assert_contains_all(haystack: &BTreeSet<String>, needles: &[&str]) {
    for needle in needles {
        assert!(
            haystack.contains(*needle),
            "expected command surface to include {needle}"
        );
    }
}

const WAKE_GENERATED_ALIASES: &[(&str, &str)] = &[
    ("wake:schedules:list", "wake:list-wake-schedules"),
    ("wake:schedules:create", "wake:create-wake-schedule"),
    ("wake:schedules:get", "wake:get-wake-schedule"),
    ("wake:schedules:update", "wake:update-wake-schedule"),
    ("wake:schedules:delete", "wake:delete-wake-schedule"),
    ("wake:schedules:run", "wake:run-wake-schedule"),
    ("wake:authorizations:list", "wake:list-wake-authorizations"),
    (
        "wake:authorizations:create",
        "wake:create-wake-authorization",
    ),
    (
        "wake:authorizations:update",
        "wake:update-wake-authorization",
    ),
    (
        "wake:authorizations:delete",
        "wake:delete-wake-authorization",
    ),
    ("wake:dispatches:list", "wake:list-wake-dispatches"),
];

#[test]
fn includes_every_generated_operation_id() {
    let surface = expected_command_surface();

    for id in operation_ids() {
        let entry = surface
            .get(&id)
            .unwrap_or_else(|| panic!("missing generated operation {id}"));
        assert_eq!(entry.target_operation_id.as_deref(), Some(id.as_str()));
    }
}

#[test]
fn includes_generated_aliases_from_manifest() {
    let surface = expected_command_surface();

    for (alias, target) in manifest::aliases() {
        let entry = surface
            .get(*alias)
            .unwrap_or_else(|| panic!("missing generated alias {alias}"));
        assert_eq!(
            entry.target_operation_id.as_deref(),
            Some(*target),
            "alias {alias} should target {target}"
        );
    }

    let ids = expected_command_ids();
    assert_contains_all(
        &ids,
        &[
            "emails:list",
            "emails:get",
            "sending:send",
            "sending:reply",
            "sent:list",
            "domains:zone-file",
            "functions:logs",
            "memories:set",
            "wake:schedules:list",
            "wake:authorizations:list",
            "wake:dispatches:list",
        ],
    );
}

#[test]
fn wake_generated_only_aliases_resolve_through_manifest_and_help() {
    let surface = expected_command_surface();

    for (alias, target) in WAKE_GENERATED_ALIASES {
        assert_eq!(manifest::resolve_alias(alias), *target);

        let spaced = alias.replace(':', " ");
        assert_eq!(manifest::resolve_alias(&spaced), *target);

        let operation = manifest::lookup_operation(alias)
            .unwrap_or_else(|| panic!("missing manifest lookup for {alias}"));
        assert_eq!(manifest::operation_id(operation), *target);

        let spaced_operation = manifest::lookup_operation(&spaced)
            .unwrap_or_else(|| panic!("missing manifest lookup for {spaced}"));
        assert_eq!(manifest::operation_id(spaced_operation), *target);

        let entry = surface
            .get(*alias)
            .unwrap_or_else(|| panic!("missing help surface alias {alias}"));
        assert_eq!(entry.source, CommandSource::GeneratedAlias);
        assert_eq!(entry.target_operation_id.as_deref(), Some(*target));
        assert!(
            known_friendly_commands()
                .iter()
                .all(|command| command.id != *alias),
            "{alias} should be covered by manifest aliases, not friendly runtime"
        );
    }
}

#[test]
fn includes_core_and_auth_friendly_commands() {
    let ids = expected_command_ids();

    assert_contains_all(
        &ids,
        &[
            "completion",
            "autocomplete",
            "list-operations",
            "describe",
            "config",
            "config:list",
            "config:set",
            "config:use",
            "config:reset",
            "doctor",
            "whoami",
            "logout",
            "login",
            "login:browser",
            "login:confirm",
            "login:otp",
            "login:otp:confirm",
            "login:otp:resend",
            "login:resend",
            "signin",
            "signin:browser",
            "signin:confirm",
            "signin:otp",
            "signin:otp:confirm",
            "signin:otp:resend",
            "signin:resend",
            "otp",
            "otp:confirm",
            "otp:resend",
            "signup",
            "signup:confirm",
            "signup:interactive",
            "signup:resend",
            "signup:status",
        ],
    );
}

#[test]
fn models_hidden_autocomplete_plugin_commands_for_surface_parity() {
    let ids: BTreeSet<String> = known_hidden_friendly_commands()
        .iter()
        .map(|command| command.id)
        .map(str::to_string)
        .collect();

    assert_contains_all(
        &ids,
        &[
            "autocomplete:create",
            "create:autocomplete",
            "autocomplete:script",
            "script:autocomplete",
        ],
    );

    let visible_ids = expected_command_ids();
    assert!(
        !visible_ids.contains("autocomplete:create"),
        "hidden autocomplete commands should not appear in the visible command surface"
    );
}

#[test]
fn includes_task_oriented_friendly_commands() {
    let ids = expected_command_ids();

    assert_contains_all(
        &ids,
        &[
            "send",
            "reply",
            "chat",
            "chat:reply",
            "emails:latest",
            "emails:watch",
            "emails:wait",
            "search",
            "semantic-search",
            "search:semantic-search",
            "domains:zone-file",
            "inbox:setup",
            "inbox:status",
            "functions:init",
            "functions:templates",
            "functions:deploy",
            "functions:redeploy",
            "functions:set-secret",
            "functions:test",
            "functions:test-function",
            "functions:route-set",
            "functions:route-unset",
            "functions:route-get",
            "functions:routing-topology",
            "functions:logs",
            "org:secrets:list",
            "org:secrets:set",
            "org:secrets:remove",
            "org:secrets:delete",
            "payloads",
            "payloads:push",
            "payloads:pull",
            "routes:add",
            "routes:list",
            "routes:test",
            "routes:update",
            "routes:reorder",
            "routes:remove",
            "memories:set",
            "memories:get",
            "memories:delete",
            "memories:search",
            "payments:register-payout-address",
            "payments:register-payout",
            "payments:charge",
            "payments:pay-challenge",
            "payments:pay",
            "payments:pay-email",
            "payments:pay-email-step",
            "payments:challenge-from-email",
            "wake:schedules:list",
            "wake:schedules:create",
            "wake:schedules:get",
            "wake:schedules:update",
            "wake:schedules:delete",
            "wake:schedules:run",
            "wake:authorizations:list",
            "wake:authorizations:create",
            "wake:authorizations:update",
            "wake:authorizations:delete",
            "wake:dispatches:list",
        ],
    );
}

#[test]
fn friendly_commands_override_generated_entries_when_they_share_an_id() {
    let surface = expected_command_surface();

    for id in [
        "domains:download-domain-zone-file",
        "functions:test-function",
        "inbox:get-inbox-status",
        "payments:register-payout-address",
        "payments:pay-challenge",
        "search:semantic-search",
    ] {
        assert_eq!(
            surface.get(id).map(|entry| entry.source),
            Some(CommandSource::Friendly),
            "{id} should be represented by the friendly command surface"
        );
    }
}

#[test]
fn every_friendly_target_points_at_a_generated_operation() {
    let operation_ids = operation_ids();

    for command in known_friendly_commands() {
        if let Some(target) = command.target_operation_id {
            assert!(
                operation_ids.contains(target),
                "friendly command {} targets missing operation {}",
                command.id,
                target
            );
        }
    }
}

#[test]
fn friendly_command_ids_are_unique() {
    let mut seen = BTreeSet::new();

    for command in known_friendly_commands() {
        assert!(
            seen.insert(command.id),
            "duplicate friendly command id {}",
            command.id
        );
    }
}

#[test]
fn exposes_space_separated_invocation_shapes_for_nested_commands() {
    let invocations = expected_command_invocations();

    assert_contains_all(
        &invocations,
        &[
            "config set",
            "emails latest",
            "emails list",
            "functions logs",
            "functions route-set",
            "login otp confirm",
            "payloads push",
            "payments pay-email",
            "routes add",
            "sending send",
            "wake schedules list",
            "wake schedules create",
            "wake schedules get",
            "wake schedules update",
            "wake schedules delete",
            "wake schedules run",
            "wake authorizations list",
            "wake authorizations create",
            "wake authorizations update",
            "wake authorizations delete",
            "wake dispatches list",
        ],
    );
}
