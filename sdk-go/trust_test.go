package primitive

import (
	"strings"
	"testing"
)

func legitTrustAuth() EmailAuth {
	policy := DmarcPolicyReject
	return EmailAuth{
		SPF:              SpfResultPass,
		DMARC:            DmarcResultPass,
		DMARCPolicy:      &policy,
		DMARCFromDomain:  strPtr("example.com"),
		DMARCSpfAligned:  boolPtr(true),
		DMARCDkimAligned: boolPtr(true),
		DKIMSignatures: []DKIMSignature{{
			Domain:   "example.com",
			Selector: strPtr("default"),
			Result:   DkimResultPass,
			Aligned:  true,
			KeyBits:  intPtr(2048),
			Algo:     strPtr("rsa-sha256"),
		}},
	}
}

func trustEvent(from string, auth EmailAuth) EmailReceivedEvent {
	var event EmailReceivedEvent
	event.Email.Headers.From = from
	event.Email.Auth = auth
	return event
}

func TestIsTrustedSenderDomainMatch(t *testing.T) {
	result, err := IsTrustedSender(trustEvent("sender@example.com", legitTrustAuth()), TrustedSenderOptions{Domain: "example.com"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Trusted || result.Retryable || result.Reason != TrustReasonTrusted {
		t.Fatalf("unexpected result: %#v", result)
	}
	if result.Auth.Verdict != AuthVerdictLegit {
		t.Fatalf("expected legit auth verdict, got %q", result.Auth.Verdict)
	}
}

func TestIsTrustedSenderExactSender(t *testing.T) {
	result, err := IsTrustedSender(trustEvent("sender@example.com", legitTrustAuth()), TrustedSenderOptions{Domain: "example.com", Sender: "SENDER@example.com"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Trusted {
		t.Fatalf("expected trusted result: %#v", result)
	}

	result, err = IsTrustedSender(trustEvent("other@example.com", legitTrustAuth()), TrustedSenderOptions{Domain: "example.com", Sender: "sender@example.com"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Trusted || result.Reason != TrustReasonSenderMismatch {
		t.Fatalf("expected sender mismatch: %#v", result)
	}
}

func TestIsTrustedSenderWhitespacePaddedDmarcDomain(t *testing.T) {
	auth := legitTrustAuth()
	padded := " Example.com "
	auth.DMARCFromDomain = &padded
	result, err := IsTrustedSender(trustEvent("sender@example.com", auth), TrustedSenderOptions{Domain: "example.com"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Trusted {
		t.Fatalf("expected trusted result: %#v", result)
	}
}

func TestIsTrustedSenderZeroValueAuth(t *testing.T) {
	result, err := IsTrustedSender(trustEvent("sender@example.com", EmailAuth{}), TrustedSenderOptions{Domain: "example.com"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Trusted || result.Retryable {
		t.Fatalf("expected permanent untrusted result: %#v", result)
	}
}

func TestIsTrustedSenderInvalidOptions(t *testing.T) {
	event := trustEvent("sender@example.com", legitTrustAuth())
	for name, opts := range map[string]TrustedSenderOptions{
		"empty domain":         {Domain: "   "},
		"address as domain":    {Domain: "user@example.com"},
		"invalid sender":       {Domain: "example.com", Sender: "not-an-email"},
		"display-name sender":  {Domain: "example.com", Sender: "Name <sender@example.com>"},
		"whitespace in domain": {Domain: "exam ple.com"},
	} {
		if _, err := IsTrustedSender(event, opts); err == nil {
			t.Fatalf("%s: expected error", name)
		}
	}
}

func TestParseFromHeaderStrictGroupSyntax(t *testing.T) {
	// mail.ParseAddressList flattens a single-member group to its
	// member, so the explicit group-delimiter guard must reject it to
	// stay aligned with the Node parser.
	if _, reason := parseFromHeaderStrict("Friends: sender@example.com;"); reason != TrustReasonFromHeaderInvalid {
		t.Fatalf("expected group-syntax rejection, got %q", reason)
	}
	// A colon inside a quoted display name is not group syntax.
	if address, _ := parseFromHeaderStrict(`"Support: Billing" <sender@example.com>`); address != "sender@example.com" {
		t.Fatalf("expected quoted-colon display name to parse, got %q", address)
	}
	// An escaped quote inside a quoted display name does not end the
	// quoted string; the colon after it stays quoted.
	if address, _ := parseFromHeaderStrict(`"a\": b" <sender@example.com>`); address != "sender@example.com" {
		t.Fatalf("expected escaped-quote display name to parse, got %q", address)
	}
	// A colon inside an IPv6 domain literal is rejected, matching the
	// Node parser (whose lexer also treats it as a group marker).
	if _, reason := parseFromHeaderStrict("user@[IPv6:2001:db8::1]"); reason != TrustReasonFromHeaderInvalid {
		t.Fatalf("expected IPv6 domain-literal rejection, got %q", reason)
	}
}

func TestParseFromHeaderStrict(t *testing.T) {
	if address, _ := parseFromHeaderStrict(`"spoofed@example.com" <attacker@evil.example.net>`); address != "attacker@evil.example.net" {
		t.Fatalf("expected angle-addr address, got %q", address)
	}
	if _, reason := parseFromHeaderStrict("a@example.com, b@example.com"); reason != TrustReasonFromHeaderMultipleAddresses {
		t.Fatalf("expected multiple-address rejection, got %q", reason)
	}
	if _, reason := parseFromHeaderStrict("not-an-email"); reason != TrustReasonFromHeaderInvalid {
		t.Fatalf("expected invalid rejection, got %q", reason)
	}
	if _, reason := parseFromHeaderStrict(""); reason != TrustReasonFromHeaderInvalid {
		t.Fatalf("expected empty rejection, got %q", reason)
	}
	if _, reason := parseFromHeaderStrict("a@" + strings.Repeat("x", maxHeaderBytes) + ".com"); reason != TrustReasonFromHeaderInvalid {
		t.Fatalf("expected over-length rejection, got %q", reason)
	}
}
