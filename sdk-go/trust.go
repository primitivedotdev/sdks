package primitive

import (
	"fmt"
	"net/mail"
	"strings"
	"unicode"
)

// TrustReason is a stable machine-readable code explaining why an email
// was or was not trusted by IsTrustedSender.
type TrustReason string

const (
	// TrustReasonTrusted means every check passed.
	TrustReasonTrusted TrustReason = "trusted"
	// TrustReasonAuthMissing means the event carried no usable auth
	// object. Present for cross-SDK parity of the reason vocabulary;
	// the typed EmailReceivedEvent input makes it unreachable in Go.
	TrustReasonAuthMissing TrustReason = "auth-missing"
	// TrustReasonAuthSuspicious means ValidateEmailAuth returned a
	// suspicious verdict (DMARC/SPF failure signals).
	TrustReasonAuthSuspicious TrustReason = "auth-suspicious"
	// TrustReasonDmarcTemperror means DMARC evaluation hit a temporary
	// DNS error. The only retryable reason; the same email may verify
	// cleanly once DNS recovers.
	TrustReasonDmarcTemperror TrustReason = "dmarc-temperror"
	// TrustReasonAuthUnknown means authenticity could not be determined
	// and the cause is not transient (most commonly the sender domain
	// publishes no DMARC record, or evaluation hit a permanent error).
	TrustReasonAuthUnknown TrustReason = "auth-unknown"
	// TrustReasonDmarcDomainMismatch means the email authenticated, but
	// the domain DMARC evaluated (the RFC 5322 From domain seen by the
	// server) is not the expected domain.
	TrustReasonDmarcDomainMismatch TrustReason = "dmarc-domain-mismatch"
	// TrustReasonFromHeaderMultipleAddresses means the From header lists
	// more than one address, which is ambiguous as an identity.
	TrustReasonFromHeaderMultipleAddresses TrustReason = "from-header-multiple-addresses"
	// TrustReasonFromHeaderInvalid means the From header is missing,
	// malformed, or fails address validation.
	TrustReasonFromHeaderInvalid TrustReason = "from-header-invalid"
	// TrustReasonFromDomainMismatch means the parsed From address's
	// domain is not the expected domain.
	TrustReasonFromDomainMismatch TrustReason = "from-domain-mismatch"
	// TrustReasonSenderMismatch means Sender was given in the options
	// and the parsed From address is a different address.
	TrustReasonSenderMismatch TrustReason = "sender-mismatch"
)

// TrustedSenderOptions configures IsTrustedSender.
type TrustedSenderOptions struct {
	// Domain is the domain the email must be authenticated as (the
	// RFC 5322 From domain). Matched exactly, case-insensitively: mail
	// from a subdomain of Domain does not match. Pass the subdomain
	// itself to accept it. Required.
	Domain string
	// Sender optionally requires an exact sender, as a bare address
	// (user@example.com). Compared case-insensitively against the
	// parsed From address. Note that DMARC authenticates the domain,
	// not the local part: the domain owner's infrastructure controls
	// which local parts it signs mail for. Empty means not checked.
	Sender string
}

// TrustedSenderResult is the trust decision for an inbound email.
type TrustedSenderResult struct {
	// Trusted is true when the email is authenticated as the expected
	// domain (and sender, if given).
	Trusted bool
	// Retryable is true only for transient failures (dmarc-temperror).
	// Callers that respond with a 5xx let webhook redelivery retry the
	// same email after DNS recovers. All other untrusted reasons are
	// permanent for this email.
	Retryable bool
	// Reason is the code for the first check that failed, or trusted.
	Reason TrustReason
	// Auth is the underlying ValidateEmailAuth result, for logging.
	Auth ValidateEmailAuthResult
}

func untrustedSender(reason TrustReason, auth ValidateEmailAuthResult, retryable bool) TrustedSenderResult {
	return TrustedSenderResult{Trusted: false, Retryable: retryable, Reason: reason, Auth: auth}
}

// parseFromHeaderStrict is the single-address From parse used by the
// trust gate. Unlike ParseHeaderAddress (which is lenient and lets the
// normalizer fall back to the attacker-controlled SMTP envelope
// sender), it rejects multi-address headers and anything that fails
// address validation, with no recovery fallbacks.
func parseFromHeaderStrict(value string) (string, TrustReason) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || len(trimmed) > maxHeaderBytes {
		return "", TrustReasonFromHeaderInvalid
	}
	addrs, err := mail.ParseAddressList(trimmed)
	if err != nil || len(addrs) == 0 {
		return "", TrustReasonFromHeaderInvalid
	}
	if len(addrs) > 1 {
		return "", TrustReasonFromHeaderMultipleAddresses
	}
	candidate := strings.TrimSpace(addrs[0].Address)
	if !headerAddressRe.MatchString(candidate) {
		return "", TrustReasonFromHeaderInvalid
	}
	return strings.ToLower(candidate), ""
}

// IsTrustedSender checks whether an inbound email is authenticated as
// an expected domain (and optionally an exact sender address).
//
// Trusted is true only when ALL of the following hold:
//
//  1. ValidateEmailAuth(event.Email.Auth) returns a legit verdict.
//  2. event.Email.Auth.DMARCFromDomain (the domain the server's DMARC
//     evaluation ran against) equals opts.Domain.
//  3. The From header strict-parses to exactly one valid address whose
//     domain equals opts.Domain.
//  4. When opts.Sender is non-empty, the parsed From address equals it
//     exactly (case-insensitive).
//
// The verdict alone says an email was authenticated, not which domain
// it was authenticated as: a fully authenticated email from an
// attacker-controlled domain is legit. Anchoring DMARCFromDomain closes
// that. The strict From parse defends the remaining gaps: a header like
// `From: "trusted@example.com" <x@evil.com>` plants an allowlisted
// address in the display name while DMARC evaluates evil.com, and
// NormalizeReceivedEmail's Sender is not a safe anchor because its
// lenient parser falls back to the attacker-controlled SMTP envelope
// sender. Reply-To is likewise never consulted.
//
// An unknown verdict caused by a DMARC temperror is surfaced with
// Retryable true (respond 5xx and let webhook redelivery retry); every
// other unknown, such as a sender domain with no DMARC record, is
// permanent for this email and not retryable.
//
// Malformed event content yields an untrusted result with a reason; an
// error is returned only for invalid options.
func IsTrustedSender(event EmailReceivedEvent, opts TrustedSenderOptions) (TrustedSenderResult, error) {
	domain := strings.ToLower(strings.TrimSpace(opts.Domain))
	if domain == "" {
		return TrustedSenderResult{}, fmt.Errorf("opts.Domain must be a non-empty domain name")
	}
	if strings.Contains(domain, "@") || strings.ContainsFunc(domain, unicode.IsSpace) {
		return TrustedSenderResult{}, fmt.Errorf("opts.Domain must be a bare domain name without @ or whitespace")
	}

	sender := strings.ToLower(strings.TrimSpace(opts.Sender))
	if sender != "" && !headerAddressRe.MatchString(sender) {
		return TrustedSenderResult{}, fmt.Errorf("opts.Sender must be a single bare email address (user@example.com)")
	}

	authResult, err := ValidateEmailAuth(event.Email.Auth)
	if err != nil {
		// A typed EmailAuth should always decode; treat a failure as
		// missing auth data rather than propagating an error, matching
		// the defensive behavior of the other SDKs.
		return untrustedSender(TrustReasonAuthMissing, ValidateEmailAuthResult{
			Verdict:    AuthVerdictUnknown,
			Confidence: AuthConfidenceLow,
			Reasons:    []string{"Missing or malformed email.auth on event"},
		}, false), nil
	}

	if authResult.Verdict == AuthVerdictSuspicious {
		return untrustedSender(TrustReasonAuthSuspicious, authResult, false), nil
	}
	if authResult.Verdict == AuthVerdictUnknown {
		// Only a DMARC temperror is transient. Every other unknown (no
		// DMARC record, permerror, no auth data) is permanent for this
		// email; marking those retryable would make callers 5xx forever
		// for senders whose domain simply publishes no DMARC record.
		if event.Email.Auth.DMARC == DmarcResultTemperror {
			return untrustedSender(TrustReasonDmarcTemperror, authResult, true), nil
		}
		return untrustedSender(TrustReasonAuthUnknown, authResult, false), nil
	}

	dmarcFromDomain := ""
	if event.Email.Auth.DMARCFromDomain != nil {
		dmarcFromDomain = strings.ToLower(strings.TrimSpace(*event.Email.Auth.DMARCFromDomain))
	}
	if dmarcFromDomain == "" || dmarcFromDomain != domain {
		return untrustedSender(TrustReasonDmarcDomainMismatch, authResult, false), nil
	}

	fromAddress, parseFailure := parseFromHeaderStrict(event.Email.Headers.From)
	if fromAddress == "" {
		return untrustedSender(parseFailure, authResult, false), nil
	}

	fromDomain := fromAddress[strings.LastIndex(fromAddress, "@")+1:]
	if fromDomain != domain {
		return untrustedSender(TrustReasonFromDomainMismatch, authResult, false), nil
	}

	if sender != "" && fromAddress != sender {
		return untrustedSender(TrustReasonSenderMismatch, authResult, false), nil
	}

	return TrustedSenderResult{Trusted: true, Retryable: false, Reason: TrustReasonTrusted, Auth: authResult}, nil
}
