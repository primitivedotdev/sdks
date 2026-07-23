use crate::manifest;
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommandSource {
    GeneratedOperation,
    GeneratedAlias,
    Friendly,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandEntry {
    pub id: String,
    pub source: CommandSource,
    pub target_operation_id: Option<String>,
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FriendlyCommand {
    pub id: &'static str,
    pub target_operation_id: Option<&'static str>,
    pub summary: &'static str,
}

pub fn known_friendly_commands() -> &'static [FriendlyCommand] {
    &[
        FriendlyCommand {
            id: "completion",
            target_operation_id: None,
            summary: "Output a shell completion script or print setup instructions",
        },
        FriendlyCommand {
            id: "autocomplete",
            target_operation_id: None,
            summary: "Display autocomplete installation instructions",
        },
        FriendlyCommand {
            id: "agent:upgrade",
            target_operation_id: None,
            summary: "Upgrade an agent account to developer",
        },
        FriendlyCommand {
            id: "list-operations",
            target_operation_id: None,
            summary: "List all generated API operations",
        },
        FriendlyCommand {
            id: "describe",
            target_operation_id: None,
            summary: "Describe a single API operation in detail",
        },
        FriendlyCommand {
            id: "config",
            target_operation_id: None,
            summary: "Manage Primitive CLI request environments",
        },
        FriendlyCommand {
            id: "config:list",
            target_operation_id: None,
            summary: "List Primitive CLI request environments",
        },
        FriendlyCommand {
            id: "config:reset",
            target_operation_id: None,
            summary: "Reset Primitive CLI request environments",
        },
        FriendlyCommand {
            id: "config:set",
            target_operation_id: None,
            summary: "Set a Primitive CLI request environment",
        },
        FriendlyCommand {
            id: "config:use",
            target_operation_id: None,
            summary: "Switch the active Primitive CLI request environment",
        },
        FriendlyCommand {
            id: "login",
            target_operation_id: None,
            summary: "Log in to an existing account",
        },
        FriendlyCommand {
            id: "login:browser",
            target_operation_id: None,
            summary: "Log in with browser approval",
        },
        FriendlyCommand {
            id: "login:confirm",
            target_operation_id: None,
            summary: "Confirm email-code login",
        },
        FriendlyCommand {
            id: "login:otp",
            target_operation_id: None,
            summary: "Start OTP login",
        },
        FriendlyCommand {
            id: "login:otp:confirm",
            target_operation_id: None,
            summary: "Confirm OTP login",
        },
        FriendlyCommand {
            id: "login:otp:resend",
            target_operation_id: None,
            summary: "Resend OTP login code",
        },
        FriendlyCommand {
            id: "login:resend",
            target_operation_id: None,
            summary: "Resend email-code login code",
        },
        FriendlyCommand {
            id: "signin",
            target_operation_id: None,
            summary: "Sign in to an existing account",
        },
        FriendlyCommand {
            id: "signin:browser",
            target_operation_id: None,
            summary: "Sign in with browser approval",
        },
        FriendlyCommand {
            id: "signin:confirm",
            target_operation_id: None,
            summary: "Confirm email-code sign-in",
        },
        FriendlyCommand {
            id: "signin:otp",
            target_operation_id: None,
            summary: "Start OTP sign-in",
        },
        FriendlyCommand {
            id: "signin:otp:confirm",
            target_operation_id: None,
            summary: "Confirm OTP sign-in",
        },
        FriendlyCommand {
            id: "signin:otp:resend",
            target_operation_id: None,
            summary: "Resend OTP sign-in code",
        },
        FriendlyCommand {
            id: "signin:resend",
            target_operation_id: None,
            summary: "Resend email-code sign-in code",
        },
        FriendlyCommand {
            id: "otp",
            target_operation_id: None,
            summary: "Start email-code auth",
        },
        FriendlyCommand {
            id: "otp:confirm",
            target_operation_id: None,
            summary: "Confirm email-code auth",
        },
        FriendlyCommand {
            id: "otp:resend",
            target_operation_id: None,
            summary: "Resend email-code auth code",
        },
        FriendlyCommand {
            id: "signup",
            target_operation_id: None,
            summary: "Start account signup",
        },
        FriendlyCommand {
            id: "signup:confirm",
            target_operation_id: None,
            summary: "Confirm account signup",
        },
        FriendlyCommand {
            id: "signup:interactive",
            target_operation_id: None,
            summary: "Run interactive account signup",
        },
        FriendlyCommand {
            id: "signup:resend",
            target_operation_id: None,
            summary: "Resend signup verification code",
        },
        FriendlyCommand {
            id: "signup:status",
            target_operation_id: None,
            summary: "Show pending signup status",
        },
        FriendlyCommand {
            id: "logout",
            target_operation_id: None,
            summary: "Log out and remove local credentials",
        },
        FriendlyCommand {
            id: "whoami",
            target_operation_id: Some("account:get-account"),
            summary: "Print the authenticated account",
        },
        FriendlyCommand {
            id: "doctor",
            target_operation_id: None,
            summary: "Run a one-shot environment health check",
        },
        FriendlyCommand {
            id: "send",
            target_operation_id: Some("sending:send-email"),
            summary: "Send an email",
        },
        FriendlyCommand {
            id: "reply",
            target_operation_id: Some("sending:reply-to-email"),
            summary: "Reply to an inbound email",
        },
        FriendlyCommand {
            id: "chat",
            target_operation_id: Some("sending:send-email"),
            summary: "Send an email and wait for the threaded reply",
        },
        FriendlyCommand {
            id: "chat:reply",
            target_operation_id: Some("sending:reply-to-email"),
            summary: "Reply in the active chat",
        },
        FriendlyCommand {
            id: "emails:latest",
            target_operation_id: Some("emails:list-emails"),
            summary: "Show the most recent inbound emails",
        },
        FriendlyCommand {
            id: "emails:watch",
            target_operation_id: Some("emails:search-emails"),
            summary: "Watch inbound emails with filters",
        },
        FriendlyCommand {
            id: "emails:wait",
            target_operation_id: Some("emails:search-emails"),
            summary: "Wait for matching inbound emails",
        },
        FriendlyCommand {
            id: "search",
            target_operation_id: Some("emails:search-emails"),
            summary: "Search mail",
        },
        FriendlyCommand {
            id: "semantic-search",
            target_operation_id: Some("search:semantic-search"),
            summary: "Search mail by semantic meaning",
        },
        FriendlyCommand {
            id: "search:semantic-search",
            target_operation_id: Some("search:semantic-search"),
            summary: "Search mail by semantic meaning",
        },
        FriendlyCommand {
            id: "domains:zone-file",
            target_operation_id: Some("domains:download-domain-zone-file"),
            summary: "Download a DNS zone file for a domain",
        },
        FriendlyCommand {
            id: "domains:download-domain-zone-file",
            target_operation_id: Some("domains:download-domain-zone-file"),
            summary: "Download a DNS zone file for a domain",
        },
        FriendlyCommand {
            id: "inbox:setup",
            target_operation_id: Some("inbox:get-inbox-status"),
            summary: "Guide inbound email setup",
        },
        FriendlyCommand {
            id: "inbox:status",
            target_operation_id: Some("inbox:get-inbox-status"),
            summary: "Show inbound email readiness",
        },
        FriendlyCommand {
            id: "inbox:get-inbox-status",
            target_operation_id: Some("inbox:get-inbox-status"),
            summary: "Show inbound email readiness",
        },
        FriendlyCommand {
            id: "functions:init",
            target_operation_id: None,
            summary: "Scaffold a Primitive Function project",
        },
        FriendlyCommand {
            id: "functions:templates",
            target_operation_id: None,
            summary: "List available Primitive Function templates",
        },
        FriendlyCommand {
            id: "functions:deploy",
            target_operation_id: Some("functions:create-function"),
            summary: "Deploy a new function from a bundled handler file",
        },
        FriendlyCommand {
            id: "functions:redeploy",
            target_operation_id: Some("functions:update-function"),
            summary: "Redeploy a function from a bundled handler file",
        },
        FriendlyCommand {
            id: "functions:set-secret",
            target_operation_id: Some("functions:set-function-secret"),
            summary: "Set a function secret",
        },
        FriendlyCommand {
            id: "functions:test",
            target_operation_id: Some("functions:test-function"),
            summary: "Trigger a test invocation",
        },
        FriendlyCommand {
            id: "functions:test-function",
            target_operation_id: Some("functions:test-function"),
            summary: "Trigger a test invocation",
        },
        FriendlyCommand {
            id: "functions:route-set",
            target_operation_id: Some("functions:set-function-route"),
            summary: "Bind inbound mail to a function",
        },
        FriendlyCommand {
            id: "functions:route-unset",
            target_operation_id: Some("functions:unset-function-route"),
            summary: "Unbind any route from a function",
        },
        FriendlyCommand {
            id: "functions:route-get",
            target_operation_id: Some("functions:get-function-routing"),
            summary: "Show a function's current route binding",
        },
        FriendlyCommand {
            id: "functions:routing-topology",
            target_operation_id: Some("functions:get-org-routing-topology"),
            summary: "Show the org-wide function routing topology",
        },
        FriendlyCommand {
            id: "functions:logs",
            target_operation_id: Some("functions:list-function-logs"),
            summary: "List or follow a function's execution logs",
        },
        FriendlyCommand {
            id: "org:secrets:list",
            target_operation_id: Some("functions:list-org-secrets"),
            summary: "List global secrets",
        },
        FriendlyCommand {
            id: "org:secrets:set",
            target_operation_id: Some("functions:create-org-secret"),
            summary: "Set a global secret",
        },
        FriendlyCommand {
            id: "org:secrets:remove",
            target_operation_id: Some("functions:delete-org-secret"),
            summary: "Delete a global secret",
        },
        FriendlyCommand {
            id: "org:secrets:delete",
            target_operation_id: Some("functions:delete-org-secret"),
            summary: "Delete a global secret",
        },
        FriendlyCommand {
            id: "payloads",
            target_operation_id: None,
            summary: "Manage encrypted payload objects",
        },
        FriendlyCommand {
            id: "payloads:push",
            target_operation_id: None,
            summary: "Stream-upload a file as an encrypted payload",
        },
        FriendlyCommand {
            id: "payloads:pull",
            target_operation_id: None,
            summary: "Stream-download and decrypt a payload to a file",
        },
        FriendlyCommand {
            id: "routes:add",
            target_operation_id: Some("routes:create-route"),
            summary: "Add a recipient route",
        },
        FriendlyCommand {
            id: "routes:list",
            target_operation_id: Some("routes:list-routes"),
            summary: "List recipient routes",
        },
        FriendlyCommand {
            id: "routes:test",
            target_operation_id: Some("routes:simulate-route"),
            summary: "Simulate routing for a recipient",
        },
        FriendlyCommand {
            id: "routes:update",
            target_operation_id: Some("routes:update-route"),
            summary: "Update a recipient route",
        },
        FriendlyCommand {
            id: "routes:reorder",
            target_operation_id: Some("routes:reorder-routes"),
            summary: "Reorder recipient routes",
        },
        FriendlyCommand {
            id: "routes:remove",
            target_operation_id: Some("routes:delete-route"),
            summary: "Remove a recipient route",
        },
        FriendlyCommand {
            id: "memories:set",
            target_operation_id: Some("memories:set-memory"),
            summary: "Set a memory",
        },
        FriendlyCommand {
            id: "memories:get",
            target_operation_id: Some("memories:get-memory"),
            summary: "Get a memory",
        },
        FriendlyCommand {
            id: "memories:delete",
            target_operation_id: Some("memories:delete-memory"),
            summary: "Delete a memory",
        },
        FriendlyCommand {
            id: "memories:search",
            target_operation_id: Some("memories:search-memories"),
            summary: "Search memories",
        },
        FriendlyCommand {
            id: "payments:register-payout-address",
            target_operation_id: Some("payments:register-payout-address"),
            summary: "Register a payout address",
        },
        FriendlyCommand {
            id: "payments:register-payout",
            target_operation_id: Some("payments:register-payout-address"),
            summary: "Register a payout address",
        },
        FriendlyCommand {
            id: "payments:charge",
            target_operation_id: Some("payments:create-challenge"),
            summary: "Request an x402 payment",
        },
        FriendlyCommand {
            id: "payments:pay-challenge",
            target_operation_id: Some("payments:pay-challenge"),
            summary: "Sign and settle an x402 payment challenge",
        },
        FriendlyCommand {
            id: "payments:pay",
            target_operation_id: Some("payments:pay-challenge"),
            summary: "Sign and settle an x402 payment challenge",
        },
        FriendlyCommand {
            id: "payments:pay-email",
            target_operation_id: Some("payments:create-email-challenge"),
            summary: "Sign and send an email x402 payment",
        },
        FriendlyCommand {
            id: "payments:pay-email-step",
            target_operation_id: Some("payments:create-email-challenge"),
            summary: "Sign an email x402 challenge into a payment-step envelope",
        },
        FriendlyCommand {
            id: "payments:challenge-from-email",
            target_operation_id: Some("emails:download-attachments"),
            summary: "Extract an x402 payment challenge from inbound email",
        },
    ]
}

pub fn known_hidden_friendly_commands() -> &'static [FriendlyCommand] {
    &[
        FriendlyCommand {
            id: "autocomplete:create",
            target_operation_id: None,
            summary: "Hidden autocomplete setup helper",
        },
        FriendlyCommand {
            id: "autocomplete:script",
            target_operation_id: None,
            summary: "Hidden autocomplete script helper",
        },
        FriendlyCommand {
            id: "create:autocomplete",
            target_operation_id: None,
            summary: "Hidden autocomplete setup helper",
        },
        FriendlyCommand {
            id: "script:autocomplete",
            target_operation_id: None,
            summary: "Hidden autocomplete script helper",
        },
    ]
}

pub fn expected_command_surface() -> BTreeMap<String, CommandEntry> {
    let mut commands = BTreeMap::new();
    let operation_ids = operation_ids();

    for operation in manifest::operation_manifest() {
        let id = manifest::operation_id(operation);
        commands.insert(
            id.clone(),
            CommandEntry {
                id: id.clone(),
                source: CommandSource::GeneratedOperation,
                target_operation_id: Some(id),
                summary: operation.summary.clone(),
            },
        );
    }

    for (alias, target) in manifest::aliases() {
        if operation_ids.contains(*target) {
            commands.insert(
                (*alias).to_string(),
                CommandEntry {
                    id: (*alias).to_string(),
                    source: CommandSource::GeneratedAlias,
                    target_operation_id: Some((*target).to_string()),
                    summary: commands
                        .get(*target)
                        .and_then(|entry| entry.summary.clone()),
                },
            );
        }
    }

    for command in known_friendly_commands() {
        commands.insert(
            command.id.to_string(),
            CommandEntry {
                id: command.id.to_string(),
                source: CommandSource::Friendly,
                target_operation_id: command.target_operation_id.map(str::to_string),
                summary: Some(command.summary.to_string()),
            },
        );
    }

    commands
}

pub fn expected_command_ids() -> BTreeSet<String> {
    expected_command_surface().into_keys().collect()
}

pub fn expected_command_invocations() -> BTreeSet<String> {
    let mut invocations = BTreeSet::new();
    for id in expected_command_surface().keys() {
        invocations.insert(id.clone());
        if id.contains(':') {
            invocations.insert(id.replace(':', " "));
        }
    }
    invocations
}

pub fn operation_ids() -> BTreeSet<String> {
    manifest::operation_manifest()
        .iter()
        .map(manifest::operation_id)
        .collect()
}
