package main

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	sdk "github.com/primitivedotdev/sdks/sdk-go"
	"math"
	"os"
)

func canonical(v any) any {
	switch v := v.(type) {
	case nil:
		return []any{"null"}
	case bool:
		return []any{"boolean", v}
	case float64:
		return []any{"number", fmt.Sprintf("%016x", math.Float64bits(v))}
	case int64:
		return []any{"number", fmt.Sprintf("%016x", math.Float64bits(float64(v)))}
	case string:
		return []any{"string", v}
	case []any:
		r := make([]any, len(v))
		for i, x := range v {
			r[i] = canonical(x)
		}
		return []any{"array", r}
	case map[string]any:
		r := map[string]any{}
		for k, x := range v {
			r[k] = canonical(x)
		}
		return []any{"object", r}
	default:
		panic(fmt.Sprintf("unexpected value %T", v))
	}
}
func run(line []byte) (out map[string]any) {
	defer func() {
		if p := recover(); p != nil {
			out = map[string]any{"crash": fmt.Sprint(p)}
		}
	}()
	var c struct {
		Mode    string
		Hex     string
		Value   any
		Special string
	}
	if err := json.Unmarshal(line, &c); err != nil {
		panic(err)
	}
	if c.Special != "" {
		obj := c.Value.(map[string]any)
		switch c.Special {
		case "cycle":
			obj["payload"] = obj
		case "alias":
			shared := map[string]any{"n": float64(1)}
			obj["payload"] = []any{shared, shared}
		case "dag":
			shared := map[string]any{"n": float64(1)}
			for i := 0; i < 20; i++ {
				shared = map[string]any{"a": shared, "b": shared}
			}
			obj["payload"] = shared
		case "host-object":
			obj["payload"] = struct{ N int }{1}
		case "bytes":
			obj["payload"] = []byte{1}
		case "function":
			obj["payload"] = func() {}
		case "bigint":
			obj["payload"] = json.Number("9007199254740993")
		case "nan":
			obj["payload"] = math.NaN()
		case "infinity":
			obj["payload"] = math.Inf(1)
		case "negative-infinity":
			obj["payload"] = math.Inf(-1)
		case "negative-zero":
			obj["payload"] = math.Copysign(0, -1)
		case "surrogate":
			obj["payload"] = string([]byte{0xed, 0xa0, 0x80})
		case "surrogate-key":
			obj["payload"] = map[string]any{string([]byte{0xed, 0xa0, 0x80}): float64(1)}
		}
	}
	raw, err := hex.DecodeString(c.Hex)
	if err != nil {
		panic(err)
	}
	var r sdk.InteractionResult
	if c.Mode == "decoded" {
		r = sdk.ValidateInteractionEnvelope(c.Value)
	} else if c.Mode == "text" {
		r = sdk.ParseInteractionEnvelopeString(string(raw))
	} else {
		r = sdk.ParseInteractionEnvelope(raw)
	}
	out = map[string]any{"status": r.Status}
	if r.Reason != "" {
		out["reason"] = r.Reason
	}
	if r.Status == "valid" {
		out["envelope"] = canonical(r.Envelope)
	}
	if r.Status == "unsupported" {
		out["version"] = canonical(r.Version)
	}
	if c.Mode == "decoded" {
		out["source"] = r.Source == nil
		if r.Status == "valid" {
			before, _ := json.Marshal(canonical(r.Envelope))
			obj := c.Value.(map[string]any)
			target := obj["payload"]
			if items, ok := target.([]any); ok && len(items) > 0 {
				switch items[0].(type) {
				case map[string]any, []any:
					target = items[0]
				}
			}
			if nested, ok := target.(map[string]any); ok {
				nested["changed"] = true
			} else if items, ok := target.([]any); ok && len(items) > 0 {
				items[0] = "changed"
			} else {
				obj["payload"] = map[string]any{"changed": true}
			}
			after, _ := json.Marshal(canonical(r.Envelope))
			out["snapshot"] = bytes.Equal(before, after)
		}
	} else if r.Status == "invalid" {
		out["source"] = r.Source == nil
	} else {
		original := bytes.Clone(raw)
		for i := range raw {
			raw[i] = 0
		}
		out["source"] = bytes.Equal(r.Source, original)
		out["sourceHash"] = fmt.Sprintf("%x", sha256.Sum256(r.Source))
	}
	return
}
func main() {
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 4096), 4<<20)
	writer := bufio.NewWriter(os.Stdout)
	defer writer.Flush()
	for scanner.Scan() {
		data, err := json.Marshal(run(scanner.Bytes()))
		if err != nil {
			panic(err)
		}
		fmt.Fprintln(writer, string(data))
	}
	if err := scanner.Err(); err != nil {
		panic(err)
	}
}
