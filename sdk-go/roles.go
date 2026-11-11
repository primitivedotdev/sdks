package primitive

// BuiltinRoleKey is the key of a built-in organization role, as the API's
// role list and CLI organization list report it. Template and custom roles
// use other keys, so a role key read from the API is a plain string.
type BuiltinRoleKey string

// The built-in role keys. Every other role, including the operator
// template, is a template or custom role with a key of its own.
const (
	RoleOwner  BuiltinRoleKey = "owner"
	RoleAdmin  BuiltinRoleKey = "admin"
	RoleMember BuiltinRoleKey = "member"
)

// BuiltinRoleKeys lists every built-in role key, in the spec's order.
func BuiltinRoleKeys() []BuiltinRoleKey {
	return []BuiltinRoleKey{RoleOwner, RoleAdmin, RoleMember}
}

// IsBuiltinRoleKey reports whether key names a built-in role.
func IsBuiltinRoleKey(key string) bool {
	for _, builtin := range BuiltinRoleKeys() {
		if string(builtin) == key {
			return true
		}
	}
	return false
}
