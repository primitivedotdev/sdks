package api

import (
	"context"

	"github.com/ogen-go/ogen/ogenerrors"
)

// Default production hosts. Two-host split exists because /send-mail
// needs a larger body cap than Vercel allows; host 2 is a Cloudflare
// Worker that accepts ~30 MiB raw. Host 1 carries everything else.
// Customers don't see this split: the top-level primitive.Client
// routes /send-mail to host 2 internally via a second underlying
// generated client, every other operation routes to host 1.
//
// Both base URLs are independently overridable via primitive.ClientOptions.
// Override is for internal staging/local testing; not part of the
// publicly-supported surface.
const (
	DefaultAPIBaseURL1 = "https://www.primitive.dev/api/v1"
	DefaultAPIBaseURL2 = "https://api.primitive.dev/v1"
	// DefaultBaseURL is a back-compat alias for DefaultAPIBaseURL1.
	DefaultBaseURL = DefaultAPIBaseURL1
)

type StaticTokenSource struct {
	APIKey             string
	DownloadTokenValue string
}

func NewStaticTokenSource(apiKey string, downloadToken string) StaticTokenSource {
	return StaticTokenSource{
		APIKey:             apiKey,
		DownloadTokenValue: downloadToken,
	}
}

func (s StaticTokenSource) BearerAuth(_ context.Context, _ OperationName) (BearerAuth, error) {
	if s.APIKey == "" {
		return BearerAuth{}, ogenerrors.ErrSkipClientSecurity
	}

	return BearerAuth{Token: s.APIKey}, nil
}

func (s StaticTokenSource) DownloadToken(_ context.Context, _ OperationName) (DownloadToken, error) {
	if s.DownloadTokenValue == "" {
		return DownloadToken{}, ogenerrors.ErrSkipClientSecurity
	}

	return DownloadToken{APIKey: s.DownloadTokenValue}, nil
}

func NewAPIClient(apiKey string, opts ...ClientOption) (*Client, error) {
	return NewClient(DefaultBaseURL, NewStaticTokenSource(apiKey, ""), opts...)
}
