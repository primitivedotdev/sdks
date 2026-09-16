// External module consumer, compiled against an archived SDK source snapshot.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strconv"

	"github.com/google/uuid"
	primitive "github.com/primitivedotdev/sdks/sdk-go"
	api "github.com/primitivedotdev/sdks/sdk-go/api"
)

func must(err error) {
	if err != nil {
		panic(err)
	}
}
func main() {
	mode, record, url, scope, kind := os.Args[1], os.Args[2], os.Args[3], os.Args[5], os.Args[6]
	now, err := strconv.ParseInt(os.Args[4], 10, 64)
	must(err)
	if mode == "prepare" {
		id := "<parent@example.test>"
		expiry := now + 60000
		result, err := primitive.PrepareSignalEmail(primitive.SignalInput{
			Kind: kind, Status: "received", ExpiresAtMs: &expiry,
			Parent: primitive.SignalParent{AccountScope: scope, From: "owner@example.test", To: "agent@example.test", MessageID: &id, Subject: "Research café", References: []string{"<ancestor@example.test>"}},
		}, primitive.SignalDependencies{UUID: uuid.NewString, Now: func() int64 { return now }})
		must(err)
		if result.Prepared == nil {
			panic("not prepared")
		}
		data, err := json.Marshal(result.Prepared)
		must(err)
		file, err := os.OpenFile(record, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
		must(err)
		_, err = file.Write(data)
		must(err)
		must(file.Sync())
		must(file.Close())
		fmt.Println(`{"status":"prepared"}`)
		return
	}
	data, err := os.ReadFile(record)
	must(err)
	var prepared primitive.PreparedSignal
	must(json.Unmarshal(data, &prepared))
	client, err := api.NewClient(url, api.NewStaticTokenSource("local"+"-fixture", ""))
	must(err)
	result, err := primitive.SendPreparedSignal(context.Background(), func(ctx context.Context, raw json.RawMessage, key string) (api.SendEmailRes, error) {
		var body api.SendMailInput
		if err := json.Unmarshal(raw, &body); err != nil {
			return nil, err
		}
		return client.SendEmail(ctx, &body, api.SendEmailParams{IdempotencyKey: api.NewOptString(key)})
	}, prepared, scope, func() int64 { return now })
	must(err)
	if result.Status == "expired" {
		output, err := json.Marshal(map[string]any{"status": "expired", "idempotencyKey": result.IdempotencyKey})
		must(err)
		fmt.Println(string(output))
		return
	}
	response, ok := result.Result.(*api.SendEmailOK)
	if !ok {
		panic("ordinary send failed")
	}
	output, err := json.Marshal(map[string]any{"status": "response", "result": map[string]any{"success": response.Success, "data": map[string]any{"id": response.Data.ID, "idempotent_replay": response.Data.IdempotentReplay}}})
	must(err)
	fmt.Println(string(output))
}
