package primitive

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"time"

	"github.com/google/uuid"
	primitiveapi "github.com/primitivedotdev/sdks/sdk-go/v3/api"
)

// Incremental conversation sync over GET /emails/{id}/conversation?since=.
//
// A since read returns the messages created or changed after a cursor, plus
// the cursor to continue from and has_more when the delta stopped at its page
// size. A message can come back in a later read with more copies listed, or
// under another id when a better copy of it becomes visible. The merge rule,
// shared by the Node, Python and Go SDKs and pinned by
// test-fixtures/conversation-sync.json:
//
//  1. Upsert each returned message by ID.
//  2. Two entries are the same message when either one's ID is in the other's
//     Copies or SentEmailID. The newer entry replaces the held one and takes
//     its place.
//  3. Order by Timestamp (millisecond precision, a missing timestamp last),
//     then by position in the held list, with new messages after held ones in
//     the order they arrived.
//
// SyncConversation normalizes each returned message's timestamp before
// decoding it: an RFC 3339 date-time with an offset is kept, one without an
// offset is read as UTC and gets "Z", and anything else becomes null. A sync
// stops with an error after MaxConversationSyncPages pages.
//
// Deleted messages are not reported by a since read. Sync again without a
// state now and then to reconcile.

// ConversationReader reads one page of GET /emails/{id}/conversation. The
// generated *primitiveapi.Client implements it.
type ConversationReader interface {
	GetConversation(ctx context.Context, params primitiveapi.GetConversationParams) (primitiveapi.GetConversationRes, error)
}

// ConversationSync is the result of a sync and the state to pass to the next
// one. Cursor and Messages are what the next sync needs. ThreadID, Subject,
// MessageCount and Truncated come from the last page read and describe the
// whole conversation; MessageCount and Truncated are unset when that page
// omitted them, as an empty delta can.
type ConversationSync struct {
	Cursor       string
	Messages     []primitiveapi.ConversationMessage
	ThreadID     primitiveapi.NilUUID
	Subject      primitiveapi.OptNilString
	MessageCount primitiveapi.OptInt
	Truncated    primitiveapi.OptBool
}

// MaxConversationSyncPages is the most pages one sync reads before it stops
// with an error.
const MaxConversationSyncPages = 1000

var rfc3339Timestamp = regexp.MustCompile(`^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})?$`)

// normalizeConversationTimestamp returns a message timestamp as the sync
// keeps it, and false when it is not one. The same checks run in the Node and
// Python SDKs, pinned by the timestamps cases of
// test-fixtures/conversation-sync.json.
func normalizeConversationTimestamp(value string) (string, bool) {
	match := rfc3339Timestamp.FindStringSubmatch(value)
	if match == nil {
		return "", false
	}
	number := func(index int) int {
		n, _ := strconv.Atoi(match[index])
		return n
	}
	year, month, day := number(1), number(2), number(3)
	if year < 1 || month < 1 || month > 12 {
		return "", false
	}
	if day < 1 || day > time.Date(year, time.Month(month)+1, 0, 0, 0, 0, 0, time.UTC).Day() {
		return "", false
	}
	if number(4) > 23 || number(5) > 59 || number(6) > 59 {
		return "", false
	}
	zone := match[8]
	if zone == "" {
		return value + "Z", true
	}
	if zone != "Z" {
		hours, _ := strconv.Atoi(zone[1:3])
		minutes, _ := strconv.Atoi(zone[4:6])
		if hours > 23 || minutes > 59 {
			return "", false
		}
	}
	return value, true
}

// normalizeConversationPayload rewrites each message timestamp of a raw
// conversation response by normalizeConversationTimestamp.
func normalizeConversationPayload(payload []byte) ([]byte, error) {
	var envelope map[string]json.RawMessage
	if err := json.Unmarshal(payload, &envelope); err != nil {
		return nil, err
	}
	var data map[string]json.RawMessage
	if err := json.Unmarshal(envelope["data"], &data); err != nil {
		return payload, nil
	}
	var messages []map[string]json.RawMessage
	if err := json.Unmarshal(data["messages"], &messages); err != nil {
		return payload, nil
	}
	for _, message := range messages {
		var timestamp string
		if json.Unmarshal(message["timestamp"], &timestamp) != nil {
			continue
		}
		if normalized, ok := normalizeConversationTimestamp(timestamp); ok {
			message["timestamp"], _ = json.Marshal(normalized)
		} else {
			message["timestamp"] = json.RawMessage("null")
		}
	}
	var err error
	if data["messages"], err = json.Marshal(messages); err != nil {
		return nil, err
	}
	if envelope["data"], err = json.Marshal(data); err != nil {
		return nil, err
	}
	return json.Marshal(envelope)
}

type heldConversationMessage struct {
	message primitiveapi.ConversationMessage
	seq     int
}

func conversationTimestampMs(message primitiveapi.ConversationMessage) float64 {
	timestamp, ok := message.Timestamp.Get()
	if !ok {
		return math.Inf(1)
	}
	return float64(timestamp.UnixMilli())
}

// linkedConversationIDs returns the ids an entry stands for besides its own:
// its copies and its send.
func linkedConversationIDs(message primitiveapi.ConversationMessage) map[uuid.UUID]struct{} {
	ids := make(map[uuid.UUID]struct{}, len(message.Copies)+1)
	for _, copied := range message.Copies {
		ids[copied.ID] = struct{}{}
	}
	if sentEmailID, ok := message.SentEmailID.Get(); ok {
		ids[sentEmailID] = struct{}{}
	}
	delete(ids, message.ID)
	return ids
}

// MergeConversationMessages merges a since delta into held messages and
// returns the new ordered list. Neither input is modified.
func MergeConversationMessages(held, delta []primitiveapi.ConversationMessage) []primitiveapi.ConversationMessage {
	entries := make([]heldConversationMessage, 0, len(held)+len(delta))
	for seq, message := range held {
		entries = append(entries, heldConversationMessage{message: message, seq: seq})
	}
	nextSeq := len(entries)
	for _, message := range delta {
		linked := linkedConversationIDs(message)
		inherited := -1
		kept := entries[:0:0]
		for _, entry := range entries {
			_, heldIsLinked := linked[entry.message.ID]
			_, incomingIsLinked := linkedConversationIDs(entry.message)[message.ID]
			if entry.message.ID != message.ID && (heldIsLinked || incomingIsLinked) {
				if inherited < 0 || entry.seq < inherited {
					inherited = entry.seq
				}
				continue
			}
			kept = append(kept, entry)
		}
		entries = kept
		replaced := false
		for index := range entries {
			if entries[index].message.ID == message.ID {
				entries[index].message = message
				replaced = true
				break
			}
		}
		if replaced {
			continue
		}
		if inherited >= 0 {
			entries = append(entries, heldConversationMessage{message: message, seq: inherited})
		} else {
			entries = append(entries, heldConversationMessage{message: message, seq: nextSeq})
			nextSeq++
		}
	}
	sort.SliceStable(entries, func(i, j int) bool {
		a, b := conversationTimestampMs(entries[i].message), conversationTimestampMs(entries[j].message)
		if a != b {
			return a < b
		}
		return entries[i].seq < entries[j].seq
	})
	merged := make([]primitiveapi.ConversationMessage, len(entries))
	for index, entry := range entries {
		merged[index] = entry.message
	}
	return merged
}

// RunConversationSync runs a sync with a caller-supplied page reader. read
// returns the conversation for one since read. It reads from state.Cursor (or
// "start" when state is nil or has no cursor) and follows HasMore until it is
// false.
func RunConversationSync(ctx context.Context, read func(ctx context.Context, since string) (primitiveapi.Conversation, error), state *ConversationSync) (*ConversationSync, error) {
	since := "start"
	var messages []primitiveapi.ConversationMessage
	if state != nil {
		if state.Cursor != "" {
			since = state.Cursor
		}
		messages = append(messages, state.Messages...)
	}
	for pages := 0; pages < MaxConversationSyncPages; pages++ {
		page, err := read(ctx, since)
		if err != nil {
			return nil, err
		}
		cursor, ok := page.Cursor.Get()
		if !ok || cursor == "" {
			return nil, &APIError{
				Message: "conversation read returned no cursor; cannot continue the sync",
				Payload: page,
			}
		}
		messages = MergeConversationMessages(messages, page.Messages)
		if hasMore, _ := page.HasMore.Get(); !hasMore {
			return &ConversationSync{
				Cursor:       cursor,
				Messages:     messages,
				ThreadID:     page.ThreadID,
				Subject:      page.Subject,
				MessageCount: page.MessageCount,
				Truncated:    page.Truncated,
			}, nil
		}
		if cursor == since {
			return nil, &APIError{
				Message: "conversation read reported has_more without advancing the cursor",
				Payload: page,
			}
		}
		since = cursor
	}
	return nil, &APIError{
		Message: fmt.Sprintf("conversation sync read %d pages without reaching the end; stopping", MaxConversationSyncPages),
		Payload: since,
	}
}

// SyncConversation brings a conversation up to date with incremental since
// reads of GET /emails/{id}/conversation, paging through has_more. With a nil
// state it reads from since=start. Pass the returned value back as state to
// read only what changed:
//
//	sync, err := primitive.SyncConversation(ctx, apiClient, emailID, nil)
//	// later
//	sync, err = primitive.SyncConversation(ctx, apiClient, emailID, sync)
//
// Messages are merged by [MergeConversationMessages].
func SyncConversation(ctx context.Context, reader ConversationReader, emailID uuid.UUID, state *ConversationSync) (*ConversationSync, error) {
	if reader == nil {
		return nil, fmt.Errorf("conversation reader is required")
	}
	raw, hasRaw := reader.(rawConversationReader)
	return RunConversationSync(ctx, func(ctx context.Context, since string) (primitiveapi.Conversation, error) {
		if hasRaw {
			return readConversationRaw(ctx, raw, emailID, since)
		}
		res, err := reader.GetConversation(ctx, primitiveapi.GetConversationParams{
			ID:    emailID,
			Since: primitiveapi.NewOptString(since),
		})
		if err != nil {
			return primitiveapi.Conversation{}, err
		}
		switch v := res.(type) {
		case *primitiveapi.GetConversationOK:
			return v.Data, nil
		case *primitiveapi.GetConversationBadRequest:
			return primitiveapi.Conversation{}, apiErrorFromErrorResponse(400, primitiveapi.ErrorResponse(*v))
		case *primitiveapi.GetConversationNotFound:
			return primitiveapi.Conversation{}, apiErrorFromErrorResponse(404, primitiveapi.ErrorResponse(*v))
		case *primitiveapi.ErrorResponseHeaders:
			// The only answer of this operation that carries headers is its
			// 401, which the generated decoder returns as the shared type.
			return primitiveapi.Conversation{}, headerError(401, *v)
		default:
			return primitiveapi.Conversation{}, &APIError{
				Message: fmt.Sprintf("primitive API get-conversation failed: %T", res),
				Payload: res,
			}
		}
	}, state)
}

// rawConversationReader is the raw request the generated *primitiveapi.Client
// also offers. SyncConversation uses it when available, so it can normalize
// timestamps before the generated decoder, which rejects anything but RFC 3339
// with an offset, reads them.
type rawConversationReader interface {
	ReceiverRequest(ctx context.Context, path string, body []byte) (*http.Response, error)
}

func readConversationRaw(ctx context.Context, raw rawConversationReader, emailID uuid.UUID, since string) (primitiveapi.Conversation, error) {
	path := "emails/" + emailID.String() + "/conversation?since=" + url.QueryEscape(since)
	response, err := raw.ReceiverRequest(ctx, path, nil)
	if err != nil {
		return primitiveapi.Conversation{}, err
	}
	defer response.Body.Close()
	payload, err := io.ReadAll(io.LimitReader(response.Body, 64<<20))
	if err != nil {
		return primitiveapi.Conversation{}, err
	}
	if response.StatusCode != http.StatusOK {
		return primitiveapi.Conversation{}, conversationHTTPError(response, payload)
	}
	normalized, err := normalizeConversationPayload(payload)
	if err != nil {
		return primitiveapi.Conversation{}, &APIError{StatusCode: response.StatusCode, Message: fmt.Sprintf("primitive API returned an invalid conversation: %v", err), Payload: string(payload)}
	}
	var page primitiveapi.GetConversationOK
	if err := page.UnmarshalJSON(normalized); err != nil {
		return primitiveapi.Conversation{}, &APIError{StatusCode: response.StatusCode, Message: fmt.Sprintf("primitive API returned an invalid conversation: %v", err), Payload: string(payload)}
	}
	return page.Data, nil
}

// conversationHTTPError maps an error answer the way the generated client's
// header-carrying error types are mapped: status, code, request id, and the
// Retry-After and ratelimit-* headers.
func conversationHTTPError(response *http.Response, payload []byte) error {
	var body primitiveapi.ErrorResponse
	if err := body.UnmarshalJSON(payload); err != nil {
		return &APIError{StatusCode: response.StatusCode, Message: fmt.Sprintf("primitive API get-conversation failed: HTTP %d", response.StatusCode), Payload: string(payload)}
	}
	intHeader := func(name string) primitiveapi.OptInt {
		if value, err := strconv.Atoi(response.Header.Get(name)); err == nil {
			return primitiveapi.NewOptInt(value)
		}
		return primitiveapi.OptInt{}
	}
	headers := primitiveapi.ErrorResponseHeaders{
		Response:           body,
		RetryAfter:         intHeader("Retry-After"),
		RatelimitLimit:     intHeader("Ratelimit-Limit"),
		RatelimitRemaining: intHeader("Ratelimit-Remaining"),
		RatelimitReset:     intHeader("Ratelimit-Reset"),
	}
	if policy := response.Header.Get("Ratelimit-Policy"); policy != "" {
		headers.RatelimitPolicy = primitiveapi.NewOptString(policy)
	}
	return headerError(response.StatusCode, headers)
}

// SyncConversation is [SyncConversation] on the client's API host. It needs
// a client built by NewClient or NewClientWithOptions, or one wrapping an API
// client that implements [ConversationReader].
func (c *Client) SyncConversation(ctx context.Context, emailID uuid.UUID, state *ConversationSync) (*ConversationSync, error) {
	if c == nil || c.api == nil {
		return nil, fmt.Errorf("client is not configured")
	}
	reader, ok := c.api.(ConversationReader)
	if !ok {
		return nil, fmt.Errorf("client API does not support GetConversation")
	}
	return SyncConversation(ctx, reader, emailID, state)
}
