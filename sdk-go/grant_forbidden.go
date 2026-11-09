package primitive

import "encoding/json"

// GrantForbiddenCode is the error code of a refusal from a narrowed grant.
const GrantForbiddenCode = "grant_forbidden"

// GrantForbiddenResource is the resource a grant_forbidden decision named.
type GrantForbiddenResource struct {
	Type string
	ID   string
}

// GrantForbiddenError is a 403 grant_forbidden, returned when the
// credential's grant does not include a permission the operation requires.
// Permission and Reason say which one and why.
//
// Every [APIError] with this code can be read as a GrantForbiddenError with
// errors.As, and errors.As with an [APIError] target keeps working:
//
//	var refused *primitive.GrantForbiddenError
//	if errors.As(err, &refused) {
//		log.Printf("needs %s (%s)", refused.Permission, refused.Reason)
//	}
type GrantForbiddenError struct {
	*APIError
	// Permission is the permission the operation requires, such as mail:send.
	Permission string
	// CredentialKind is the kind of credential that was refused, such as org_key.
	CredentialKind string
	// GrantTemplateKey is the grant template, when the credential holds one.
	GrantTemplateKey string
	// CredentialGrantID is the concrete grant id, when the credential holds one.
	CredentialGrantID string
	// CatalogVersion is the version of the permission catalog the decision used.
	CatalogVersion string
	// Reason says why the grant refused, such as permission_missing.
	Reason string
	// Missing is a further permission the operation requires, when that is
	// the one missing.
	Missing string
	// Resource is the resource the decision was about, or nil.
	Resource *GrantForbiddenResource
}

// Unwrap returns the underlying [APIError].
func (e *GrantForbiddenError) Unwrap() error {
	if e == nil || e.APIError == nil {
		return nil
	}
	return e.APIError
}

// As lets errors.As read a grant_forbidden [APIError] as a
// [GrantForbiddenError].
func (e *APIError) As(target any) bool {
	refused, ok := target.(**GrantForbiddenError)
	if !ok || e == nil || e.Code != GrantForbiddenCode {
		return false
	}
	*refused = newGrantForbiddenError(e)
	return true
}

func newGrantForbiddenError(e *APIError) *GrantForbiddenError {
	refused := &GrantForbiddenError{APIError: e}
	if e.Details == nil {
		return refused
	}
	details := e.Details
	refused.Permission = details.Permission.Or("")
	refused.CredentialKind = details.CredentialKind.Or("")
	refused.GrantTemplateKey = details.GrantTemplateKey.Or("")
	refused.CredentialGrantID = details.CredentialGrantID.Or("")
	refused.CatalogVersion = details.CatalogVersion.Or("")
	refused.Reason = details.Reason.Or("")
	if raw, ok := details.AdditionalProps["missing"]; ok {
		var missing string
		if json.Unmarshal(raw, &missing) == nil {
			refused.Missing = missing
		}
	}
	if raw, ok := details.AdditionalProps["resource"]; ok {
		var resource struct {
			Type string `json:"type"`
			ID   string `json:"id"`
		}
		if json.Unmarshal(raw, &resource) == nil && resource.Type != "" && resource.ID != "" {
			refused.Resource = &GrantForbiddenResource{Type: resource.Type, ID: resource.ID}
		}
	}
	return refused
}
