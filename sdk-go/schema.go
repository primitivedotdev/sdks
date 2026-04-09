package primitive

import (
	"encoding/json"
	"sync"

	"github.com/xeipuuv/gojsonschema"
)

var EmailReceivedEventJSONSchema map[string]any

var (
	schemaOnce   sync.Once
	schemaLoader *gojsonschema.Schema
	schemaErr    error
)

func init() {
	_ = json.Unmarshal(emailReceivedEventSchemaJSON, &EmailReceivedEventJSONSchema)
}

func compiledSchema() (*gojsonschema.Schema, error) {
	schemaOnce.Do(func() {
		schemaLoader, schemaErr = gojsonschema.NewSchema(gojsonschema.NewBytesLoader(emailReceivedEventSchemaJSON))
	})
	return schemaLoader, schemaErr
}
