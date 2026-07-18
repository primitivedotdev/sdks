use primitive_rust::domains_commands::{
    auth_flags, build_domains_command_plan, build_list_domains_request,
    build_zone_file_download_request, domains_command_aliases, domains_command_target,
    domains_zone_file_help_text, has_time_flag, initial_zone_file_request,
    is_domains_friendly_command, select_domain_by_name, write_zone_file_output_with,
    DomainZoneFileSelector, ZoneFileOutputDestination, ZoneFileWriteOutcome,
};
use primitive_rust::manifest;
use serde_json::json;
use std::collections::BTreeMap;

fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| value.to_string()).collect()
}

#[test]
fn domain_aliases_point_at_generated_zone_file_operation() {
    let expected = ["domains:zone-file", "domains:download-domain-zone-file"];

    assert_eq!(domains_command_aliases().len(), expected.len());
    for alias in expected {
        assert!(is_domains_friendly_command(alias));
        assert_eq!(
            domains_command_target(&alias.replace(':', " ")),
            Some("domains:download-domain-zone-file")
        );
    }

    let operation = manifest::lookup_operation("domains:download-domain-zone-file")
        .expect("generated zone-file operation");
    assert_eq!(operation.method, "GET");
    assert_eq!(operation.path, "/domains/{id}/zone-file");
    assert!(operation.binary_response);
}

#[test]
fn zone_file_help_documents_command_flags() {
    let help = domains_zone_file_help_text();
    for expected in [
        "domains zone-file",
        "--domain <domain>",
        "--id <domain-id>",
        "-o, --output <path>",
        "--outbound-only",
        "--api-key <value>",
    ] {
        assert!(help.contains(expected), "{expected}");
    }
    assert!(!help.contains("--api-base-url"));
}

#[test]
fn plans_zone_file_by_id_download_request_and_runtime_flags() {
    let plan = build_domains_command_plan(
        "domains zone-file",
        &args(&[
            "--id",
            "domain/123",
            "--outbound-only",
            "--output",
            "example.com.zone",
            "--api-key",
            "ignored",
            "--time",
        ]),
    )
    .expect("zone file by id plan");

    assert_eq!(
        plan.target_operation_id,
        "domains:download-domain-zone-file"
    );
    assert_eq!(
        plan.selector,
        DomainZoneFileSelector::Id("domain/123".to_string())
    );
    assert!(plan.outbound_only);
    assert_eq!(
        plan.output,
        ZoneFileOutputDestination::File("example.com.zone".to_string())
    );
    assert_eq!(
        initial_zone_file_request(&plan),
        build_zone_file_download_request("domain/123", true)
    );

    let request = build_zone_file_download_request("domain/123", true);
    assert_eq!(
        request.target_operation_id,
        "domains:download-domain-zone-file"
    );
    assert_eq!(request.method, "GET");
    assert_eq!(request.path, "/domains/domain%2F123/zone-file");
    assert_eq!(
        request.query,
        BTreeMap::from([("outbound_only".to_string(), "true".to_string())])
    );
    assert_eq!(request.body, None);
}

#[test]
fn plans_zone_file_by_domain_as_list_then_download() {
    let plan = build_domains_command_plan(
        "domains:download-domain-zone-file",
        &args(&[
            "--domain",
            "example.com",
            "-o",
            "example.com.zone",
            "--outbound-only=false",
            "--api-base-url=https://api.example.test/v1",
        ]),
    )
    .expect("zone file by domain plan");

    assert_eq!(
        plan.selector,
        DomainZoneFileSelector::Domain("example.com".to_string())
    );
    assert!(!plan.outbound_only);
    assert_eq!(
        plan.output,
        ZoneFileOutputDestination::File("example.com.zone".to_string())
    );
    assert_eq!(
        initial_zone_file_request(&plan),
        build_list_domains_request()
    );
    assert_eq!(build_list_domains_request().path, "/domains");

    let flags = auth_flags(&args(&[
        "--domain",
        "example.com",
        "--api-key=sk_test",
        "--api-base-url",
        "https://api.example.test/v1",
    ]))
    .expect("auth flags");
    assert_eq!(
        flags,
        BTreeMap::from([
            (
                "api-base-url".to_string(),
                "https://api.example.test/v1".to_string()
            ),
            ("api-key".to_string(), "sk_test".to_string()),
        ])
    );
    assert!(has_time_flag(&args(&["--time"])));
    assert!(has_time_flag(&args(&["--time=true"])));
    assert!(!has_time_flag(&args(&["--time=false", "--no-time"])));
}

#[test]
fn selects_domain_id_from_list_response() {
    let response = json!({
        "data": [
            { "id": "domain_1", "domain": "other.example" },
            { "id": "domain_2", "domain": "Example.COM" }
        ]
    });

    let selection =
        select_domain_by_name(&response, "example.com").expect("case-insensitive match");
    assert_eq!(selection.id, "domain_2");
    assert_eq!(selection.domain, "Example.COM");

    let array_selection = select_domain_by_name(
        &json!([{ "id": "domain_3", "domain": "array.example" }]),
        "array.example",
    )
    .expect("array response");
    assert_eq!(array_selection.id, "domain_3");
}

#[test]
fn rejects_missing_or_ambiguous_zone_file_inputs() {
    let missing = build_domains_command_plan("domains:zone-file", &args(&[]))
        .expect_err("missing selector should fail");
    assert!(missing
        .to_string()
        .contains("Pass --id <domain-id> or --domain <domain>."));

    let both = build_domains_command_plan(
        "domains:zone-file",
        &args(&["--id", "domain_1", "--domain", "example.com"]),
    )
    .expect_err("ambiguous selector should fail");
    assert!(both
        .to_string()
        .contains("Use only one of --id or --domain."));

    let missing_domain = select_domain_by_name(
        &json!({ "data": [{ "id": "domain_1", "domain": "example.com" }] }),
        "missing.example",
    )
    .expect_err("missing domain should fail");
    assert!(missing_domain
        .to_string()
        .contains("Domain missing.example was not found."));

    let ambiguous = select_domain_by_name(
        &json!({
            "data": [
                { "id": "domain_1", "domain": "Example.com" },
                { "id": "domain_2", "domain": "example.COM" }
            ]
        }),
        "example.com",
    )
    .expect_err("ambiguous case-insensitive domain should fail");
    assert!(ambiguous.to_string().contains("matched multiple domains"));
}

#[test]
fn writes_zone_file_bytes_to_selected_destination() {
    let bytes = b"$ORIGIN example.com.\n\0raw";
    let mut file_writes = Vec::new();
    let mut stdout = Vec::new();
    let file_outcome = write_zone_file_output_with(
        &ZoneFileOutputDestination::File("example.com.zone".to_string()),
        bytes,
        |path, bytes| {
            file_writes.push((path.to_string(), bytes.to_vec()));
            Ok(())
        },
        |bytes| {
            stdout.extend_from_slice(bytes);
            Ok(())
        },
    )
    .expect("file write");

    assert_eq!(
        file_outcome,
        ZoneFileWriteOutcome::File {
            path: "example.com.zone".to_string(),
            bytes: bytes.len()
        }
    );
    assert_eq!(
        file_writes,
        vec![("example.com.zone".to_string(), bytes.to_vec())]
    );
    assert!(stdout.is_empty());

    let mut file_writes = Vec::new();
    let mut stdout = Vec::new();
    let stdout_outcome = write_zone_file_output_with(
        &ZoneFileOutputDestination::Stdout,
        bytes,
        |path, bytes| {
            file_writes.push((path.to_string(), bytes.to_vec()));
            Ok(())
        },
        |bytes| {
            stdout.extend_from_slice(bytes);
            Ok(())
        },
    )
    .expect("stdout write");

    assert_eq!(
        stdout_outcome,
        ZoneFileWriteOutcome::Stdout { bytes: bytes.len() }
    );
    assert!(file_writes.is_empty());
    assert_eq!(stdout, bytes);
}
