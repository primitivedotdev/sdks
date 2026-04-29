package primitive

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	primitiveapi "github.com/primitivedotdev/sdks/sdk-go/api"
)

var emailRegex = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

type sendAPI interface {
	SendEmail(ctx context.Context, request *primitiveapi.SendMailInput) (primitiveapi.SendEmailRes, error)
}

type SendThread struct {
	InReplyTo  string
	References []string
}

type SendParams struct {
	From     string
	To       string
	Subject  string
	BodyText string
	BodyHTML string
	Thread   *SendThread
}

type ReplyParams struct {
	BodyText string
	Subject  string
}

type ForwardParams struct {
	To       string
	BodyText string
	Subject  string
	From     string
}

type SendResult struct {
	QueueID  primitiveapi.OptString
	Accepted []string
	Rejected []string
}

type APIError struct {
	StatusCode int
	Code       string
	Message    string
	Payload    any
}

func (e *APIError) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

type Client struct {
	api sendAPI
}

func NewClient(apiKey string, opts ...primitiveapi.ClientOption) (*Client, error) {
	apiClient, err := primitiveapi.NewAPIClient(apiKey, opts...)
	if err != nil {
		return nil, err
	}

	return &Client{api: apiClient}, nil
}

func NewClientFromAPI(apiClient sendAPI) *Client {
	return &Client{api: apiClient}
}

func validateEmailAddress(field string, value string) error {
	if !emailRegex.MatchString(value) {
		return fmt.Errorf("%s must be a valid email address", field)
	}
	return nil
}

func validateSendParams(params SendParams) error {
	if err := validateEmailAddress("from", params.From); err != nil {
		return err
	}
	if err := validateEmailAddress("to", params.To); err != nil {
		return err
	}
	if strings.TrimSpace(params.Subject) == "" {
		return fmt.Errorf("subject must be a non-empty string")
	}
	if params.BodyText == "" && params.BodyHTML == "" {
		return fmt.Errorf("one of body text or body html is required")
	}
	return nil
}

func validateForwardParams(params ForwardParams) error {
	if err := validateEmailAddress("to", params.To); err != nil {
		return err
	}
	if params.From != "" {
		if err := validateEmailAddress("from", params.From); err != nil {
			return err
		}
	}
	if params.Subject != "" && strings.TrimSpace(params.Subject) == "" {
		return fmt.Errorf("subject must be a non-empty string")
	}
	return nil
}

func apiErrorFromErrorResponse(status int, response primitiveapi.ErrorResponse) *APIError {
	return &APIError{
		StatusCode: status,
		Code:       string(response.Error.Code),
		Message:    response.Error.Message,
		Payload:    response,
	}
}

func mapSendError(res primitiveapi.SendEmailRes) error {
	switch v := res.(type) {
	case *primitiveapi.SendEmailBadGateway:
		return apiErrorFromErrorResponse(502, primitiveapi.ErrorResponse(*v))
	case *primitiveapi.SendEmailBadRequest:
		return apiErrorFromErrorResponse(400, primitiveapi.ErrorResponse(*v))
	case *primitiveapi.SendEmailForbidden:
		return apiErrorFromErrorResponse(403, primitiveapi.ErrorResponse(*v))
	case *primitiveapi.SendEmailGatewayTimeout:
		return apiErrorFromErrorResponse(504, primitiveapi.ErrorResponse(*v))
	case *primitiveapi.SendEmailRequestEntityTooLarge:
		return apiErrorFromErrorResponse(413, primitiveapi.ErrorResponse(*v))
	case *primitiveapi.SendEmailUnauthorized:
		return apiErrorFromErrorResponse(401, primitiveapi.ErrorResponse(*v))
	default:
		return &APIError{
			Message: fmt.Sprintf("primitive API send failed: %T", res),
			Payload: res,
		}
	}
}

func (c *Client) Send(ctx context.Context, params SendParams) (SendResult, error) {
	var zero SendResult

	if c == nil || c.api == nil {
		return zero, fmt.Errorf("client is not configured")
	}
	if err := validateSendParams(params); err != nil {
		return zero, err
	}

	request := &primitiveapi.SendMailInput{
		From:    params.From,
		To:      params.To,
		Subject: params.Subject,
	}
	if params.BodyText != "" {
		request.BodyText = primitiveapi.NewOptString(params.BodyText)
	}
	if params.BodyHTML != "" {
		request.BodyHTML = primitiveapi.NewOptString(params.BodyHTML)
	}
	if params.Thread != nil {
		if params.Thread.InReplyTo != "" {
			request.InReplyTo = primitiveapi.NewOptString(params.Thread.InReplyTo)
		}
		if len(params.Thread.References) > 0 {
			request.References = params.Thread.References
		}
	}

	res, err := c.api.SendEmail(ctx, request)
	if err != nil {
		return zero, err
	}

	switch v := res.(type) {
	case *primitiveapi.SendEmailOK:
		return SendResult{
			QueueID:  v.Data.QueueID,
			Accepted: v.Data.Accepted,
			Rejected: v.Data.Rejected,
		}, nil
	default:
		return zero, mapSendError(res)
	}
}

func (c *Client) Reply(ctx context.Context, email *ReceivedEmail, input ReplyParams) (SendResult, error) {
	var zero SendResult
	if email == nil {
		return zero, fmt.Errorf("email is required")
	}

	references := append([]string{}, email.Thread.References...)
	if email.Thread.MessageID != "" {
		references = append(references, email.Thread.MessageID)
	}

	return c.Send(ctx, SendParams{
		From:     email.ReceivedBy,
		To:       email.ReplyTarget.Address,
		Subject:  firstNonEmpty(input.Subject, email.ReplySubject),
		BodyText: input.BodyText,
		Thread: &SendThread{
			InReplyTo:  email.Thread.MessageID,
			References: references,
		},
	})
}

func (c *Client) Forward(ctx context.Context, email *ReceivedEmail, input ForwardParams) (SendResult, error) {
	var zero SendResult
	if email == nil {
		return zero, fmt.Errorf("email is required")
	}
	if err := validateForwardParams(input); err != nil {
		return zero, err
	}

	return c.Send(ctx, SendParams{
		From:     firstNonEmpty(input.From, email.ReceivedBy),
		To:       input.To,
		Subject:  firstNonEmpty(input.Subject, email.ForwardSubject),
		BodyText: buildForwardText(*email, input.BodyText),
	})
}

func buildForwardText(email ReceivedEmail, intro string) string {
	parts := []string{}
	if strings.TrimSpace(intro) != "" {
		parts = append(parts, strings.TrimSpace(intro), "")
	}

	parts = append(parts,
		"---------- Forwarded message ----------",
		fmt.Sprintf("From: %s", FormatAddress(email.Sender)),
		fmt.Sprintf("To: %s", email.Raw.Email.Headers.To),
		fmt.Sprintf("Subject: %s", email.Subject),
	)
	if email.Raw.Email.Headers.Date != nil {
		parts = append(parts, fmt.Sprintf("Date: %s", *email.Raw.Email.Headers.Date))
	}
	if email.Thread.MessageID != "" {
		parts = append(parts, fmt.Sprintf("Message-ID: %s", email.Thread.MessageID))
	}
	parts = append(parts, "", email.Text)

	return strings.TrimRight(strings.Join(parts, "\n"), "\n")
}

func firstNonEmpty(candidates ...string) string {
	for _, candidate := range candidates {
		if strings.TrimSpace(candidate) != "" {
			return candidate
		}
	}
	return ""
}
