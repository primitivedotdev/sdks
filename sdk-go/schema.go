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
	var schema map[string]any
	if err := json.Unmarshal(emailReceivedEventSchemaJSON, &schema); err != nil {
		panic("primitive: invalid embedded email received event schema: " + err.Error())
	}
	EmailReceivedEventJSONSchema = schema
}

func compiledSchema() (*gojsonschema.Schema, error) {
	schemaOnce.Do(func() {
		schemaLoader, schemaErr = gojsonschema.NewSchema(gojsonschema.NewBytesLoader(emailReceivedEventSchemaJSON))
	})
	return schemaLoader, schemaErr
}
