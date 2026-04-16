package api

import (
	"context"

	"github.com/ogen-go/ogen/ogenerrors"
)

const DefaultBaseURL = "https://www.primitive.dev/api/v1"

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

func (s StaticTokenSource) BearerAuth(_ context.Context, _ string) (BearerAuth, error) {
	if s.APIKey == "" {
		return BearerAuth{}, ogenerrors.ErrSkipClientSecurity
	}

	return BearerAuth{Token: s.APIKey}, nil
}

func (s StaticTokenSource) DownloadToken(_ context.Context, _ string) (DownloadToken, error) {
	if s.DownloadTokenValue == "" {
		return DownloadToken{}, ogenerrors.ErrSkipClientSecurity
	}

	return DownloadToken{APIKey: s.DownloadTokenValue}, nil
}

func NewAPIClient(apiKey string, opts ...ClientOption) (*Client, error) {
	return NewClient(DefaultBaseURL, NewStaticTokenSource(apiKey, ""), opts...)
}
