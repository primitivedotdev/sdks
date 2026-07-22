use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParameterManifest {
    #[serde(default, rename = "default", skip_serializing_if = "Option::is_none")]
    pub default_value: Option<Value>,
    pub description: Option<String>,
    #[serde(default, rename = "enum")]
    pub enum_values: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_length: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_length: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub maximum: Option<serde_json::Number>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub minimum: Option<serde_json::Number>,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pattern: Option<String>,
    pub required: bool,
    #[serde(rename = "type")]
    pub type_name: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationManifest {
    pub binary_response: bool,
    pub body_required: bool,
    pub command: String,
    pub description: Option<String>,
    pub has_json_body: bool,
    #[serde(default)]
    pub header_params: Vec<ParameterManifest>,
    pub method: String,
    pub operation_id: String,
    pub path: String,
    #[serde(default)]
    pub path_params: Vec<ParameterManifest>,
    #[serde(default)]
    pub query_params: Vec<ParameterManifest>,
    pub request_schema: Option<Value>,
    pub response_schema: Option<Value>,
    pub sdk_name: String,
    pub summary: Option<String>,
    pub tag: String,
    pub tag_command: String,
}

pub fn operation_manifest() -> &'static [OperationManifest] {
    static MANIFEST: std::sync::OnceLock<Vec<OperationManifest>> = std::sync::OnceLock::new();
    MANIFEST.get_or_init(|| {
        serde_json::from_str(include_str!("operation-manifest.json"))
            .expect("operation-manifest.json must be valid JSON")
    })
}

pub fn operation_id(operation: &OperationManifest) -> String {
    format!("{}:{}", operation.tag_command, operation.command)
}

pub fn aliases() -> &'static [(&'static str, &'static str)] {
    &[
        ("account:show", "account:get-account"),
        ("account:storage", "account:get-storage-stats"),
        ("account:webhook-secret", "account:get-webhook-secret"),
        ("agent:claim", "agent:start-agent-claim"),
        ("agent:claim-link", "agent:create-agent-claim-link"),
        ("agent:claim-verify", "agent:verify-agent-claim"),
        ("agent:create", "agent:create-agent-account"),
        ("deliveries:list", "webhook-deliveries:list-deliveries"),
        ("deliveries:replay", "webhook-deliveries:replay-delivery"),
        ("domains:add", "domains:add-domain"),
        ("domains:delete", "domains:delete-domain"),
        ("domains:list", "domains:list-domains"),
        ("domains:update", "domains:update-domain"),
        ("domains:verify", "domains:verify-domain"),
        ("emails:conversation", "emails:get-conversation"),
        ("emails:delete", "emails:delete-email"),
        ("emails:discard-content", "emails:discard-email-content"),
        ("emails:download-raw", "emails:download-raw-email"),
        ("emails:get", "emails:get-email"),
        ("emails:list", "emails:list-emails"),
        ("emails:replay-webhooks", "emails:replay-email-webhooks"),
        ("emails:search", "emails:search-emails"),
        ("endpoints:create", "endpoints:create-endpoint"),
        ("endpoints:delete", "endpoints:delete-endpoint"),
        ("endpoints:list", "endpoints:list-endpoints"),
        ("endpoints:test", "endpoints:test-endpoint"),
        ("endpoints:update", "endpoints:update-endpoint"),
        ("filters:create", "filters:create-filter"),
        ("filters:delete", "filters:delete-filter"),
        ("filters:list", "filters:list-filters"),
        ("filters:update", "filters:update-filter"),
        ("functions:delete", "functions:delete-function"),
        (
            "functions:delete-secret",
            "functions:delete-function-secret",
        ),
        ("functions:get", "functions:get-function"),
        ("functions:list", "functions:list-functions"),
        ("functions:list-secrets", "functions:list-function-secrets"),
        ("registries:agent", "registries:get-agent"),
        ("registries:agents", "registries:list-registry-agents"),
        ("registries:create", "registries:create-registry"),
        ("registries:decide", "registries:decide-registry-request"),
        ("registries:define", "registries:define-agent"),
        ("registries:get", "registries:get-registry"),
        ("registries:list", "registries:list-registries"),
        ("registries:publish", "registries:publish-agent"),
        ("registries:requests", "registries:list-registry-requests"),
        ("registries:resolve", "registries:resolve-registry-handle"),
        ("registries:unpublish", "registries:unpublish-agent"),
        ("registries:update", "registries:update-registry"),
        ("sending:get", "sending:get-sent-email"),
        ("sending:list", "sending:list-sent-emails"),
        ("sending:permissions", "sending:get-send-permissions"),
        ("sending:reply", "sending:reply-to-email"),
        ("sending:send", "sending:send-email"),
        ("sent:get", "sending:get-sent-email"),
        ("sent:list", "sending:list-sent-emails"),
        ("threads:get", "threads:get-thread"),
        (
            "wake:authorizations:create",
            "wake:create-wake-authorization",
        ),
        (
            "wake:authorizations:delete",
            "wake:delete-wake-authorization",
        ),
        ("wake:authorizations:list", "wake:list-wake-authorizations"),
        (
            "wake:authorizations:update",
            "wake:update-wake-authorization",
        ),
        ("wake:dispatches:list", "wake:list-wake-dispatches"),
        ("wake:schedules:create", "wake:create-wake-schedule"),
        ("wake:schedules:delete", "wake:delete-wake-schedule"),
        ("wake:schedules:get", "wake:get-wake-schedule"),
        ("wake:schedules:list", "wake:list-wake-schedules"),
        ("wake:schedules:run", "wake:run-wake-schedule"),
        ("wake:schedules:update", "wake:update-wake-schedule"),
        (
            "webhook-deliveries:list",
            "webhook-deliveries:list-deliveries",
        ),
        (
            "webhook-deliveries:replay",
            "webhook-deliveries:replay-delivery",
        ),
        ("domains:zone-file", "domains:download-domain-zone-file"),
        ("functions:logs", "functions:list-function-logs"),
        ("memories:delete", "memories:delete-memory"),
        ("memories:get", "memories:get-memory"),
        ("memories:search", "memories:search-memories"),
        ("memories:set", "memories:set-memory"),
        ("reply", "sending:reply-to-email"),
    ]
}

pub fn generated_cli_aliases() -> &'static [(&'static str, &'static str)] {
    &[
        ("account:show", "account:get-account"),
        ("account:storage", "account:get-storage-stats"),
        ("account:webhook-secret", "account:get-webhook-secret"),
        ("agent:claim", "agent:start-agent-claim"),
        ("agent:claim-link", "agent:create-agent-claim-link"),
        ("agent:claim-verify", "agent:verify-agent-claim"),
        ("agent:create", "agent:create-agent-account"),
        ("deliveries:list", "webhook-deliveries:list-deliveries"),
        ("deliveries:replay", "webhook-deliveries:replay-delivery"),
        ("domains:add", "domains:add-domain"),
        ("domains:delete", "domains:delete-domain"),
        ("domains:list", "domains:list-domains"),
        ("domains:update", "domains:update-domain"),
        ("domains:verify", "domains:verify-domain"),
        ("emails:conversation", "emails:get-conversation"),
        ("emails:delete", "emails:delete-email"),
        ("emails:discard-content", "emails:discard-email-content"),
        ("emails:download-raw", "emails:download-raw-email"),
        ("emails:get", "emails:get-email"),
        ("emails:list", "emails:list-emails"),
        ("emails:replay-webhooks", "emails:replay-email-webhooks"),
        ("emails:search", "emails:search-emails"),
        ("endpoints:create", "endpoints:create-endpoint"),
        ("endpoints:delete", "endpoints:delete-endpoint"),
        ("endpoints:list", "endpoints:list-endpoints"),
        ("endpoints:test", "endpoints:test-endpoint"),
        ("endpoints:update", "endpoints:update-endpoint"),
        ("filters:create", "filters:create-filter"),
        ("filters:delete", "filters:delete-filter"),
        ("filters:list", "filters:list-filters"),
        ("filters:update", "filters:update-filter"),
        ("functions:delete", "functions:delete-function"),
        (
            "functions:delete-secret",
            "functions:delete-function-secret",
        ),
        ("functions:get", "functions:get-function"),
        ("functions:list", "functions:list-functions"),
        ("functions:list-secrets", "functions:list-function-secrets"),
        ("registries:agent", "registries:get-agent"),
        ("registries:agents", "registries:list-registry-agents"),
        ("registries:create", "registries:create-registry"),
        ("registries:decide", "registries:decide-registry-request"),
        ("registries:define", "registries:define-agent"),
        ("registries:get", "registries:get-registry"),
        ("registries:list", "registries:list-registries"),
        ("registries:publish", "registries:publish-agent"),
        ("registries:requests", "registries:list-registry-requests"),
        ("registries:resolve", "registries:resolve-registry-handle"),
        ("registries:unpublish", "registries:unpublish-agent"),
        ("registries:update", "registries:update-registry"),
        ("sending:get", "sending:get-sent-email"),
        ("sending:list", "sending:list-sent-emails"),
        ("sending:permissions", "sending:get-send-permissions"),
        ("sending:reply", "sending:reply-to-email"),
        ("sending:send", "sending:send-email"),
        ("sent:get", "sending:get-sent-email"),
        ("sent:list", "sending:list-sent-emails"),
        ("threads:get", "threads:get-thread"),
        (
            "webhook-deliveries:list",
            "webhook-deliveries:list-deliveries",
        ),
        (
            "webhook-deliveries:replay",
            "webhook-deliveries:replay-delivery",
        ),
    ]
}

pub fn resolve_alias(id: &str) -> &str {
    let normalized = normalize_lookup_token(id);
    aliases()
        .iter()
        .find_map(|(alias, target)| {
            (*alias == id || normalize_lookup_token(alias) == normalized).then_some(*target)
        })
        .unwrap_or(id)
}

fn is_generated_cli_alias(id: &str) -> bool {
    generated_cli_aliases()
        .iter()
        .any(|(alias, _)| matches_cli_id(id, alias))
}

fn resolve_generated_cli_alias(id: &str) -> &str {
    generated_cli_aliases()
        .iter()
        .find_map(|(alias, target)| matches_cli_id(id, alias).then_some(*target))
        .unwrap_or(id)
}

fn is_overridden_operation_id(id: &str) -> bool {
    matches!(
        id,
        "domains:download-domain-zone-file"
            | "functions:test-function"
            | "inbox:get-inbox-status"
            | "search:semantic-search"
            | "payments:register-payout-address"
            | "payments:pay-challenge"
    )
}

pub fn uses_generated_cli_help(id: &str) -> bool {
    let Some(operation) = lookup_cli_operation(id) else {
        return false;
    };
    let operation_id = operation_id(operation);
    if is_overridden_operation_id(&operation_id) {
        return false;
    }
    matches_cli_id(id.trim(), &operation_id) || is_generated_cli_alias(id.trim())
}

fn normalize_lookup_token(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .flat_map(|ch| ch.to_lowercase())
        .collect()
}

fn matches_cli_id(input: &str, id: &str) -> bool {
    input == id || input == id.replace(':', " ")
}

pub fn lookup_cli_operation(id: &str) -> Option<&'static OperationManifest> {
    let trimmed = resolve_generated_cli_alias(id.trim());
    operation_manifest()
        .iter()
        .find(|operation| matches_cli_id(trimmed, &operation_id(operation)))
}

pub fn lookup_operation(id: &str) -> Option<&'static OperationManifest> {
    let trimmed = resolve_alias(id.trim());
    let normalized = normalize_lookup_token(trimmed);
    operation_manifest().iter().find(|operation| {
        let tokens = [
            operation_id(operation),
            operation.command.clone(),
            operation.operation_id.clone(),
            operation.sdk_name.clone(),
            format!("{}:{}", operation.tag_command, operation.operation_id),
            format!("{}:{}", operation.tag_command, operation.sdk_name),
        ];
        tokens
            .iter()
            .any(|token| token == trimmed || normalize_lookup_token(token) == normalized)
    })
}

pub fn operation_requires_auth(operation: &OperationManifest) -> bool {
    !matches!(
        operation.sdk_name.as_str(),
        "startCliLogin"
            | "pollCliLogin"
            | "startCliSignup"
            | "resendCliSignupVerification"
            | "verifyCliSignup"
            | "startAgentSignup"
            | "resendAgentSignupVerification"
            | "verifyAgentSignup"
            | "createAgentAccount"
            | "listTemplates"
            | "getTemplate"
            | "getRegistry"
            | "listRegistryAgents"
            | "resolveRegistryHandle"
            | "getAgent"
    )
}

pub fn flag_name(name: &str) -> String {
    name.replace('_', "-").to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_canonical_aliases() {
        let operation = lookup_operation("sending:send").expect("sending alias");
        assert_eq!(operation.operation_id, "sendEmail");
    }

    #[test]
    fn knows_public_operations_do_not_require_auth() {
        let operation = lookup_operation("templates:list-templates").expect("templates list");
        assert!(!operation_requires_auth(operation));
    }

    #[test]
    fn distinguishes_generated_help_aliases_from_friendly_aliases() {
        assert!(uses_generated_cli_help("emails:get"));
        assert!(uses_generated_cli_help("emails get"));
        assert!(uses_generated_cli_help("emails:get-email"));
        assert!(uses_generated_cli_help("emails get-email"));
        assert!(!uses_generated_cli_help("getEmail"));
        assert!(!uses_generated_cli_help("get-email"));
        assert!(!uses_generated_cli_help("emailsget"));
        assert!(!uses_generated_cli_help("emails get email"));
        assert!(!uses_generated_cli_help("memories:set"));
        assert!(!uses_generated_cli_help("domains:zone-file"));
        assert!(!uses_generated_cli_help("payments:pay-challenge"));
    }

    #[test]
    fn cli_lookup_accepts_only_command_ids_and_generated_aliases() {
        assert_eq!(
            lookup_cli_operation("emails:get").map(operation_id),
            Some("emails:get-email".to_string())
        );
        assert_eq!(
            lookup_cli_operation("emails get").map(operation_id),
            Some("emails:get-email".to_string())
        );
        assert_eq!(
            lookup_cli_operation("emails:get-email").map(operation_id),
            Some("emails:get-email".to_string())
        );
        assert_eq!(
            lookup_cli_operation("emails get-email").map(operation_id),
            Some("emails:get-email".to_string())
        );

        assert!(lookup_cli_operation("getEmail").is_none());
        assert!(lookup_cli_operation("get-email").is_none());
        assert!(lookup_cli_operation("emailsget").is_none());
        assert!(lookup_cli_operation("emails get email").is_none());
    }

    #[test]
    fn list_operations_serialization_omits_absent_defaults() {
        let operation = lookup_operation("account:get-account").expect("get account");
        let value = serde_json::to_string(operation).expect("serialize operation");
        assert!(!value.contains("\"default\":null"));
        assert!(!value.contains("\"maximum\":null"));
        assert!(!value.contains("\"minimum\":null"));
    }
}
