package primitive

import (
	"fmt"
	"strings"

	"github.com/xeipuuv/gojsonschema"
)

func toFieldPath(field string) string {
	if field == "" || field == "(root)" {
		return "payload"
	}
	field = strings.TrimPrefix(field, "(root)")
	field = strings.TrimPrefix(field, ".")
	if field == "" {
		return "payload"
	}
	return field
}

func formatValidationIssue(issue gojsonschema.ResultError) (string, string, string) {
	field := validationIssuePath(issue)
	switch issue.Type() {
	case "required":
		missing := fmt.Sprint(issue.Details()["property"])
		return field, fmt.Sprintf("Missing required field: %s", missing), fmt.Sprintf("Add the required field \"%s\" to the webhook payload.", missing)
	case "const":
		return field, fmt.Sprintf("Invalid value for %s: %s", field, issue.Description()), fmt.Sprintf("Check the value of \"%s\" in the webhook payload.", field)
	case "invalid_type":
		return field, fmt.Sprintf("Invalid type for %s: %s", field, issue.Description()), fmt.Sprintf("Check the value of \"%s\" in the webhook payload.", field)
	default:
		return field, fmt.Sprintf("Validation failed for %s: %s", field, issue.Description()), fmt.Sprintf("Check the value of \"%s\" in the webhook payload.", field)
	}
}

func validationIssuePath(issue gojsonschema.ResultError) string {
	field := toFieldPath(issue.Field())
	if issue.Type() != "required" {
		return field
	}

	missing := fmt.Sprint(issue.Details()["property"])
	if field == "payload" {
		return missing
	}
	return field + "." + missing
}

func createValidationError(issues []gojsonschema.ResultError) *WebhookValidationError {
	validationIssues := make([]ValidationIssue, 0, len(issues))
	for _, issue := range issues {
		validationIssues = append(validationIssues, ValidationIssue{
			Path:      validationIssuePath(issue),
			Message:   issue.Description(),
			Validator: issue.Type(),
		})
	}
	if len(issues) == 0 {
		return NewWebhookValidationError(
			"payload",
			"Webhook payload failed schema validation",
			"Check the structure of the webhook payload against \"EmailReceivedEventJSONSchema\".",
			validationIssues,
		)
	}
	field, message, suggestion := formatValidationIssue(issues[0])
	return NewWebhookValidationError(field, message, suggestion, validationIssues)
}

func ValidateEmailReceivedEvent(input any) (*EmailReceivedEvent, error) {
	schema, err := compiledSchema()
	if err != nil {
		return nil, err
	}
	result, err := schema.Validate(gojsonschema.NewGoLoader(input))
	if err != nil {
		return nil, err
	}
	if !result.Valid() {
		return nil, createValidationError(result.Errors())
	}
	event, err := decodeInto[EmailReceivedEvent](input)
	if err != nil {
		return nil, err
	}
	return &event, nil
}

func SafeValidateEmailReceivedEvent(input any) ValidationResult[*EmailReceivedEvent] {
	event, err := ValidateEmailReceivedEvent(input)
	if err != nil {
		validationErr, ok := err.(*WebhookValidationError)
		if !ok {
			return ValidationResult[*EmailReceivedEvent]{Success: false, Error: NewWebhookValidationError("payload", err.Error(), "Check the webhook payload structure.", nil)}
		}
		return ValidationResult[*EmailReceivedEvent]{Success: false, Error: validationErr}
	}
	return ValidationResult[*EmailReceivedEvent]{Success: true, Data: event}
}
