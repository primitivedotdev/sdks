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
	SendEmail(ctx context.Context, request *primitiveapi.SendInput) (primitiveapi.SendEmailRes, error)
}

type SendParams struct {
	From    string
	To      string
	Subject string
	Body    string
}

type SendResult = primitiveapi.SendResult

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
	if params.Body == "" {
		return fmt.Errorf("body must be a non-empty string")
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

	res, err := c.api.SendEmail(ctx, &primitiveapi.SendInput{
		From:    params.From,
		To:      params.To,
		Subject: params.Subject,
		Body:    params.Body,
	})
	if err != nil {
		return zero, err
	}

	switch v := res.(type) {
	case *primitiveapi.SendEmailOK:
		return v.Data, nil
	default:
		return zero, mapSendError(res)
	}
}
