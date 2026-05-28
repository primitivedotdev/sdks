/**
 * OpenAPI document for the Primitive API.
 *
 * AUTO-GENERATED - DO NOT EDIT
 * Run `pnpm generate:openapi` to regenerate.
 */

export const openapiDocument: Record<string, unknown> = {
  "openapi": "3.1.0",
  "info": {
    "title": "Primitive API",
    "version": "1.0.0",
    "description": "The Primitive API lets you manage domains, emails, webhook endpoints,\nfilters, and account settings programmatically.\n\n## Authentication\n\nMost endpoints require a Bearer token in the `Authorization` header:\n\n```\nAuthorization: Bearer prim_<your_api_key>\n```\n\nAPI keys are org-scoped. Create and manage them in your dashboard\nunder Settings > API Keys. CLI login plus CLI/agent signup endpoints\nexplicitly declare `security: []`; they do not require an API key because\nthey are used to create OAuth CLI sessions.\n\n## Rate Limiting\n\nThe API enforces a sliding window rate limit of **120 requests per\n60 seconds** per organization. When exceeded, the API returns `429`\nwith a `Retry-After` header indicating how many seconds to wait.\n\n## Pagination\n\nList endpoints use cursor-based pagination. Responses include a\n`meta` object with `total`, `limit`, and `cursor` fields. Pass the\n`cursor` value as a query parameter to fetch the next page. When\n`cursor` is `null`, there are no more results.\n\n## Response Format\n\nAll responses use a consistent envelope:\n\n```json\n{\n  \"success\": true,\n  \"data\": { ... },\n  \"meta\": { \"total\": 42, \"limit\": 50, \"cursor\": \"...\" }\n}\n```\n\nErrors follow the same pattern:\n\n```json\n{\n  \"success\": false,\n  \"error\": { \"code\": \"not_found\", \"message\": \"Email not found\" }\n}\n```\n\n## Webhook signing\n\nOutbound webhook deliveries (configured via the `endpoints` API)\nare signed so receivers can verify they came from Primitive and\nhave not been tampered with in transit. The signing scheme is\ndeliberately simple so it can be reimplemented in any language\nin a few lines. The Node SDK's `verifyWebhookSignature` helper\nis the reference implementation; the wire details below let you\nwrite a verifier in Python, Go, Ruby, etc. without reading our\nsource.\n\n**Header**: `Primitive-Signature: t=<unix-seconds>,v1=<hex>`\n\nA legacy `MyMX-Signature` header is also sent on every delivery\nwith the same value, retained for back-compatibility with\nintegrations written before the rename. New code should read\n`Primitive-Signature`.\n\n**Signed string**: `${timestamp}.${rawBody}` where `timestamp`\nis the Unix-seconds integer from the `t=` parameter and\n`rawBody` is the exact bytes of the HTTP request body BEFORE\nany JSON decoding. Verify against the raw body, not a\nre-serialized parse, or you will silently mismatch on\ninsignificant whitespace.\n\n**Signature**: HMAC-SHA256 of the signed string, hex-encoded\n(lowercase). Use the account's webhook secret as the HMAC key,\nas a UTF-8 byte sequence.\n\n**Secret**: returned by `GET /account/webhook-secret`. The\nstring looks base64-shaped (e.g. `XNHBBW8VqoBjRfNs1tkZj11jTk...`)\nbut is NOT base64; use it AS-IS as a UTF-8 string for the HMAC\nkey. Base64-decoding before HMAC will silently produce\nmismatched signatures.\n\n**Tolerance**: by convention, reject deliveries whose `t=`\ntimestamp is more than 5 minutes off your wall-clock to defend\nagainst replay attacks. The Node SDK's helper enforces this by\ndefault.\n\n**Verification recipe** (any language):\n\n```\n1. Read the raw HTTP body (do not parse).\n2. Read `Primitive-Signature: t=<ts>,v1=<sig>`.\n3. Reject if abs(now - ts) > 300 seconds.\n4. expected = HMAC_SHA256_hex(secret_utf8, f\"{ts}.{rawBody}\")\n5. Constant-time compare expected to sig. Reject if not equal.\n```\n\nFor Node, use `verifyWebhookSignature` from\n`@primitivedotdev/sdk/webhook` (or the higher-level\n`handleWebhook` helper if you want a one-liner). For other\nlanguages, the recipe above is everything you need.\n\nTest deliveries: `POST /endpoints/{id}/test` triggers a fake\ndelivery to your endpoint URL, signed with your real account\nsecret, so you can confirm verification end-to-end without\nneeding real inbound mail. The test response carries the exact\n`signature` header value sent on the wire so you can compare\nstrings directly.\n",
    "contact": {
      "name": "Primitive",
      "url": "https://primitive.dev"
    },
    "license": {
      "name": "Proprietary",
      "url": "https://primitive.dev/terms"
    }
  },
  "servers": [
    {
      "url": "https://www.primitive.dev/api/v1",
      "description": "Primary API host (PRIMITIVE_API_BASE_URL_1). Carries every operation\nexcept attachment-supporting send. Vercel-backed; request body is\ncapped at 4.5 MB by the platform.\n"
    },
    {
      "url": "https://api.primitive.dev/v1",
      "description": "Attachments-supporting send host (PRIMITIVE_API_BASE_URL_2).\nCloudflare Worker with a ~30 MiB raw request body cap (before\nbase64 encoding). Today only `/send-mail` is hosted here; future\nlarge-body operations will migrate here over time. SDK clients\nroute /send-mail to this server automatically.\n"
    }
  ],
  "security": [
    {
      "BearerAuth": []
    }
  ],
  "tags": [
    {
      "name": "CLI",
      "description": "Browser-assisted CLI authentication"
    },
    {
      "name": "Agent",
      "description": "Agent signup and authentication"
    },
    {
      "name": "Account",
      "description": "Manage your account settings, storage, and webhook secret"
    },
    {
      "name": "Domains",
      "description": "Claim, verify, and manage email domains"
    },
    {
      "name": "Inbox",
      "description": "Check inbound email setup and processing readiness"
    },
    {
      "name": "Emails",
      "description": "List, inspect, and manage received emails"
    },
    {
      "name": "Search",
      "description": "Semantic and hybrid search across received and sent mail"
    },
    {
      "name": "Sending",
      "description": "Send outbound emails through the Primitive API"
    },
    {
      "name": "Threads",
      "description": "Conversation threads spanning received and sent emails"
    },
    {
      "name": "Endpoints",
      "description": "Manage webhook endpoints that receive email events"
    },
    {
      "name": "Filters",
      "description": "Manage whitelist and blocklist filter rules"
    },
    {
      "name": "Webhook Deliveries",
      "description": "View and replay webhook delivery attempts"
    },
    {
      "name": "Functions",
      "description": "Deploy JavaScript handlers that run on inbound mail. Each function\nis a single ESM module whose default export is an object with an\nasync `fetch(request, env)` method, in the shape of a Workers-style\nhandler. Primitive signs each delivery and forwards the\n`Primitive-Signature` header to the handler; verify the raw request\nbody with `PRIMITIVE_WEBHOOK_SECRET` before trusting the parsed\n`email.received` event (see `EmailReceivedEvent` and the Webhook\npayload section for the full schema). Code runs on\nPrimitive's edge runtime; there is no infrastructure to manage.\nSecrets land in `env` as encrypted bindings and are refreshed on\nevery redeploy.\n"
    }
  ],
  "paths": {
    "/cli/login/start": {
      "post": {
        "operationId": "startCliLogin",
        "summary": "Start CLI browser login",
        "description": "Starts a browser-assisted CLI login session. The response includes a\ndevice code for polling and a user code that the user approves in the\nbrowser. This endpoint does not require an API key.\n",
        "tags": [
          "CLI"
        ],
        "security": [],
        "requestBody": {
          "required": false,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/StartCliLoginInput"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "CLI login session created",
            "headers": {
              "Cache-Control": {
                "schema": {
                  "type": "string"
                },
                "description": "Always `no-store`"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/CliLoginStartResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      }
    },
    "/cli/login/poll": {
      "post": {
        "operationId": "pollCliLogin",
        "summary": "Poll CLI browser login",
        "description": "Polls a CLI login session until the browser approval either succeeds,\nis denied, expires, or is polled too quickly. The OAuth token set is\ncreated only after approval and is returned exactly once.\n",
        "tags": [
          "CLI"
        ],
        "security": [],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/PollCliLoginInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "CLI login approved and OAuth token set created",
            "headers": {
              "Cache-Control": {
                "schema": {
                  "type": "string"
                },
                "description": "Always `no-store`"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/CliLoginPollResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "description": "Invalid request, pending authorization, slow polling, expired token, or invalid device code",
            "headers": {
              "Retry-After": {
                "schema": {
                  "type": "integer"
                },
                "description": "Seconds to wait before polling again when the error code is `slow_down`"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                },
                "examples": {
                  "authorization_pending": {
                    "summary": "Awaiting browser approval",
                    "value": {
                      "success": false,
                      "error": {
                        "code": "authorization_pending",
                        "message": "CLI login is still pending browser approval"
                      }
                    }
                  },
                  "expired_token": {
                    "summary": "Login session expired",
                    "value": {
                      "success": false,
                      "error": {
                        "code": "expired_token",
                        "message": "CLI login code expired; run primitive login again"
                      }
                    }
                  },
                  "invalid_device_code": {
                    "summary": "Unknown device code",
                    "value": {
                      "success": false,
                      "error": {
                        "code": "invalid_device_code",
                        "message": "Invalid CLI login device code"
                      }
                    }
                  },
                  "slow_down": {
                    "summary": "Polling too quickly",
                    "value": {
                      "success": false,
                      "error": {
                        "code": "slow_down",
                        "message": "Polling too quickly; slow down and retry later"
                      }
                    }
                  }
                }
              }
            }
          },
          "403": {
            "description": "CLI login was denied in the browser",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                },
                "example": {
                  "success": false,
                  "error": {
                    "code": "access_denied",
                    "message": "CLI login was denied in the browser"
                  }
                }
              }
            }
          }
        }
      }
    },
    "/cli/signup/start": {
      "post": {
        "operationId": "startCliSignup",
        "summary": "Start CLI account signup",
        "description": "Starts a terminal-native CLI signup. The API validates the signup code,\ncreates a pending signup session, sends an email verification code, and\nreturns an opaque signup token used by the resend and verify steps. This\nendpoint does not require an API key.\n",
        "tags": [
          "CLI"
        ],
        "security": [],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/StartCliSignupInput"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "CLI signup session created and verification email sent",
            "headers": {
              "Cache-Control": {
                "schema": {
                  "type": "string"
                },
                "description": "Always `no-store`"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/CliSignupStartResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      }
    },
    "/cli/signup/resend": {
      "post": {
        "operationId": "resendCliSignupVerification",
        "summary": "Resend CLI signup verification code",
        "description": "Sends a new email verification code for a pending CLI signup session.\nThis endpoint does not require an API key.\n",
        "tags": [
          "CLI"
        ],
        "security": [],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ResendCliSignupVerificationInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Verification email resent",
            "headers": {
              "Cache-Control": {
                "schema": {
                  "type": "string"
                },
                "description": "Always `no-store`"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/CliSignupResendResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "description": "Invalid token or expired token",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "429": {
            "description": "Global rate limit exceeded or resend requested too quickly",
            "headers": {
              "Retry-After": {
                "schema": {
                  "type": "integer"
                },
                "description": "Seconds to wait before retrying"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    "/cli/signup/verify": {
      "post": {
        "operationId": "verifyCliSignup",
        "summary": "Verify CLI signup and create OAuth session",
        "description": "Verifies the email code for a CLI signup session, creates the account,\nredeems the reserved signup code, creates an org-scoped OAuth CLI\nsession, and returns the token set exactly once. This endpoint does not\nrequire an API key.\n",
        "tags": [
          "CLI"
        ],
        "security": [],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/VerifyCliSignupInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "CLI signup verified and OAuth token set created",
            "headers": {
              "Cache-Control": {
                "schema": {
                  "type": "string"
                },
                "description": "Always `no-store`"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/CliSignupVerifyResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "description": "Invalid request, invalid verification code, expired token, invalid signup code, rejected password, or account creation failure",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      }
    },
    "/agent/signup/start": {
      "post": {
        "operationId": "startAgentSignup",
        "summary": "Start agent account signup",
        "description": "Starts an agent-native signup session. The API validates the signup code,\ncreates a pending signup session, sends an email verification code, and\nreturns an opaque signup token used by the resend and verify steps. This\nendpoint does not require an API key.\n",
        "tags": [
          "Agent"
        ],
        "security": [],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/StartAgentSignupInput"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Agent signup session created and verification email sent",
            "headers": {
              "Cache-Control": {
                "schema": {
                  "type": "string"
                },
                "description": "Always `no-store`"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/AgentSignupStartResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      }
    },
    "/agent/signup/resend": {
      "post": {
        "operationId": "resendAgentSignupVerification",
        "summary": "Resend agent signup verification code",
        "description": "Sends a new email verification code for a pending agent signup session.\nThis endpoint does not require an API key.\n",
        "tags": [
          "Agent"
        ],
        "security": [],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ResendAgentSignupVerificationInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Verification email resent",
            "headers": {
              "Cache-Control": {
                "schema": {
                  "type": "string"
                },
                "description": "Always `no-store`"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/AgentSignupResendResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "description": "Invalid token or expired token",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "429": {
            "description": "Global rate limit exceeded or resend requested too quickly",
            "headers": {
              "Retry-After": {
                "schema": {
                  "type": "integer"
                },
                "description": "Seconds to wait before retrying"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    "/agent/signup/verify": {
      "post": {
        "operationId": "verifyAgentSignup",
        "summary": "Verify agent signup and create OAuth tokens",
        "description": "Verifies the email code for an agent signup session, creates the account\nwhen needed, redeems the reserved signup code, mints an org-scoped OAuth\nsession for CLI authentication, and returns the raw tokens exactly once.\nFor existing users, the optional `org_id` selects which accessible\nworkspace should receive the new session.\n",
        "tags": [
          "Agent"
        ],
        "security": [],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/VerifyAgentSignupInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Agent signup verified and OAuth tokens created",
            "headers": {
              "Cache-Control": {
                "schema": {
                  "type": "string"
                },
                "description": "Always `no-store`"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/AgentSignupVerifyResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "description": "Invalid request, invalid verification code, expired token, invalid signup code, or account creation failure",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "409": {
            "description": "Existing account is not in a usable workspace state",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      }
    },
    "/cli/logout": {
      "post": {
        "operationId": "cliLogout",
        "summary": "Revoke the current CLI OAuth session",
        "description": "Revokes the OAuth grant used to authenticate the request. API-key\nauthenticated legacy logout requests succeed without deleting server API\nkeys so old local CLI state can be cleared safely.\n",
        "tags": [
          "CLI"
        ],
        "requestBody": {
          "required": false,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CliLogoutInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "CLI logout completed",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/CliLogoutResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/account": {
      "get": {
        "operationId": "getAccount",
        "summary": "Get account info",
        "tags": [
          "Account"
        ],
        "responses": {
          "200": {
            "description": "Account details",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/Account"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      },
      "patch": {
        "operationId": "updateAccount",
        "summary": "Update account settings",
        "tags": [
          "Account"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateAccountInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Updated account",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/AccountUpdated"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/account/storage": {
      "get": {
        "operationId": "getStorageStats",
        "summary": "Get storage usage",
        "tags": [
          "Account"
        ],
        "responses": {
          "200": {
            "description": "Storage statistics",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/StorageStats"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/account/webhook-secret": {
      "get": {
        "operationId": "getWebhookSecret",
        "summary": "Get webhook signing secret",
        "description": "Returns the webhook signing secret for your account. If no\nsecret exists yet, one is generated automatically on first\naccess.\n\nSigning is account-scoped, not per-endpoint. Every webhook\ndelivery from any of your registered endpoints is signed\nwith this single secret. Rotate via\n`POST /account/webhook-secret/rotate`.\n\n**Secret format**: the returned string looks base64-shaped\n(e.g. `XNHBBW8VqoBjRfNs1tkZj11jTk...`) but is NOT base64.\nUse it AS-IS as a UTF-8 string when computing HMAC over a\ndelivery body. Base64-decoding before HMAC will silently\nproduce mismatched signatures.\n\nSee the API-level \"Webhook signing\" section for the full\nwire format (header name, signed string shape, hash algo,\ntolerance) including a language-agnostic verification\nrecipe.\n",
        "tags": [
          "Account"
        ],
        "responses": {
          "200": {
            "description": "Webhook secret",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/WebhookSecret"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/account/webhook-secret/rotate": {
      "post": {
        "operationId": "rotateWebhookSecret",
        "summary": "Rotate webhook signing secret",
        "description": "Generates a new webhook signing secret, replacing the current one.\nRate limited to once per 60 minutes.\n",
        "tags": [
          "Account"
        ],
        "responses": {
          "200": {
            "description": "New webhook secret",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/WebhookSecret"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      }
    },
    "/domains": {
      "get": {
        "operationId": "listDomains",
        "summary": "List all domains",
        "description": "Returns all verified and unverified domains for your organization,\nsorted by creation date (newest first). Each domain includes a\n`verified` boolean to distinguish between the two states.\n",
        "tags": [
          "Domains"
        ],
        "responses": {
          "200": {
            "description": "List of domains",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "type": "array",
                          "items": {
                            "$ref": "#/components/schemas/Domain"
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          }
        }
      },
      "post": {
        "operationId": "addDomain",
        "summary": "Claim a new domain",
        "description": "Creates an unverified domain claim and returns the exact\nDNS records to publish in `dns_records`. Publish those\nrecords before calling the verify endpoint. To give users\nan importable DNS file, call `downloadDomainZoneFile` or run\n`primitive domains zone-file --id <domain-id>`.\n",
        "tags": [
          "Domains"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AddDomainInput"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Domain claim created",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/UnverifiedDomain"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "409": {
            "description": "Domain claim conflicts with existing state. Two error codes\nare possible:\n  * `mx_conflict`: the domain's current MX records point at\n    another mailbox provider. The response includes\n    `error.details.mx_conflict` with the detected provider\n    and a suggested subdomain.\n  * `conflict`: the domain is already claimed by another\n    org, or a pending claim exists for another user.\n",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                },
                "examples": {
                  "mx_conflict": {
                    "summary": "Domain has MX records on another provider",
                    "value": {
                      "success": false,
                      "error": {
                        "code": "mx_conflict",
                        "message": "Domain is currently receiving mail via another provider",
                        "details": {
                          "mx_conflict": {
                            "provider_name": "Google Workspace",
                            "suggested_subdomain": "mail"
                          }
                        }
                      }
                    }
                  },
                  "already_claimed": {
                    "summary": "Domain already claimed by another org",
                    "value": {
                      "success": false,
                      "error": {
                        "code": "conflict",
                        "message": "Domain is already claimed by another organization"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/domains/{id}": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "patch": {
        "operationId": "updateDomain",
        "summary": "Update domain settings",
        "description": "Update a verified domain's settings. Only verified domains can be\nupdated. Per-domain spam thresholds require a Pro plan.\n",
        "tags": [
          "Domains"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateDomainInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Updated domain",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/VerifiedDomain"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      },
      "delete": {
        "operationId": "deleteDomain",
        "summary": "Delete a domain",
        "description": "Deletes a verified or unverified domain claim.",
        "tags": [
          "Domains"
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/Deleted"
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/domains/{id}/verify": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "post": {
        "operationId": "verifyDomain",
        "summary": "Verify domain ownership",
        "description": "Checks DNS records required for inbound routing, ownership,\nand outbound authentication: MX, ownership TXT, SPF, DKIM,\nDMARC, and TLS-RPT.\nOn success, the domain is promoted from unverified to verified.\nOn failure, returns which checks passed and which failed,\nplus the exact DNS records still expected. To give users\nan importable DNS file for missing records, call\n`downloadDomainZoneFile` or run\n`primitive domains zone-file --id <domain-id>`.\n",
        "tags": [
          "Domains"
        ],
        "responses": {
          "200": {
            "description": "Verification result",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/DomainVerifyResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/domains/{id}/zone-file": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "get": {
        "operationId": "downloadDomainZoneFile",
        "summary": "Download domain DNS zone file",
        "description": "Downloads a BIND-format DNS zone file containing the DNS records\nrequired for a domain claim. Agents should offer this after\n`addDomain` when users want to import DNS records instead of\ncopying each record manually.\n",
        "tags": [
          "Domains"
        ],
        "parameters": [
          {
            "name": "outbound_only",
            "in": "query",
            "schema": {
              "type": "boolean"
            },
            "description": "When true, include only outbound DNS records. Verified domains\ndefault to outbound-only; pending claims default to all required\nrecords.\n"
          }
        ],
        "responses": {
          "200": {
            "description": "BIND-format zone file",
            "content": {
              "text/plain": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            },
            "headers": {
              "Content-Disposition": {
                "schema": {
                  "type": "string",
                  "example": "attachment; filename=\"example.com.zone\""
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      }
    },
    "/inbox/status": {
      "get": {
        "operationId": "getInboxStatus",
        "summary": "Get inbound inbox readiness",
        "description": "Returns one consolidated view of inbound domain readiness,\nwebhook/function processing routes, deployed Functions, and\nrecent inbound email activity.\n\nAgents should call this before guiding a user through inbound\nsetup. It answers the practical questions \"can I receive mail\",\n\"will anything process that mail\", and \"what should I do next\"\nwithout forcing clients to stitch together domains, endpoints,\nfunctions, and emails manually.\n",
        "tags": [
          "Inbox"
        ],
        "responses": {
          "200": {
            "description": "Consolidated inbox readiness status",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/InboxStatus"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      }
    },
    "/emails": {
      "get": {
        "operationId": "listEmails",
        "summary": "List inbound emails",
        "description": "Returns a paginated list of INBOUND emails received at your\nverified domains. Outbound messages sent via /send-mail are\nnot included; this endpoint is the inbox view, not a\nunified send/receive history.\n\nSupports filtering by domain, status, date range, and\nfree-text search across subject, sender, and recipient\nfields.\n\nFor a compact text-table summary of the most recent N\ninbounds (no filters, no cursor pagination), the CLI ships\n`primitive emails:latest` as a one-line-per-email shortcut.\nIt's TTY-aware so id columns are full UUIDs when piped, and\na `--json` flag returns the same envelope this endpoint\ndoes. Use whichever fits the call site.\n",
        "tags": [
          "Emails"
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/Cursor"
          },
          {
            "$ref": "#/components/parameters/Limit"
          },
          {
            "name": "domain_id",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "description": "Filter by domain ID"
          },
          {
            "name": "status",
            "in": "query",
            "schema": {
              "$ref": "#/components/schemas/EmailStatus"
            },
            "description": "Filter inbound rows by lifecycle status. See `EmailStatus`\nfor what each value means. Note that the webhook delivery\nstate is a SEPARATE lifecycle on the same row; filter by\n`webhook_status` semantics is not currently supported on\nthis endpoint.\n"
          },
          {
            "name": "search",
            "in": "query",
            "schema": {
              "type": "string",
              "maxLength": 500
            },
            "description": "Search subject, sender, and recipient (case-insensitive)"
          },
          {
            "name": "date_from",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "description": "Filter emails created on or after this timestamp"
          },
          {
            "name": "date_to",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "description": "Filter emails created on or before this timestamp"
          }
        ],
        "responses": {
          "200": {
            "description": "Paginated list of emails",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/ListEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "type": "array",
                          "items": {
                            "$ref": "#/components/schemas/EmailSummary"
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          }
        }
      }
    },
    "/emails/search": {
      "get": {
        "operationId": "searchEmails",
        "summary": "Search inbound emails",
        "description": "Searches inbound emails with structured filters and optional\nfull-text matching across parsed email fields. This endpoint is\noptimized for filtered inbox views and CLI polling workflows:\ncallers that only need new accepted mail can pass\n`sort=received_at_asc`, `snippet=false`, `include_facets=false`,\nand a `date_from` timestamp.\n\n`q`, `subject`, and `body` use the same English full-text index\nas the web inbox search. Structured filters such as `from`, `to`,\n`domain_id`, status, attachment presence, and spam score bounds\nare combined with the text query.\n",
        "tags": [
          "Emails"
        ],
        "parameters": [
          {
            "name": "q",
            "in": "query",
            "schema": {
              "type": "string",
              "maxLength": 500
            },
            "description": "Full-text search DSL query."
          },
          {
            "name": "from",
            "in": "query",
            "schema": {
              "type": "string",
              "maxLength": 255
            },
            "description": "Filter by sender address or sender domain."
          },
          {
            "name": "to",
            "in": "query",
            "schema": {
              "type": "string",
              "maxLength": 255
            },
            "description": "Filter by recipient address or recipient domain."
          },
          {
            "name": "subject",
            "in": "query",
            "schema": {
              "type": "string",
              "maxLength": 500
            },
            "description": "Full-text search restricted to the subject field."
          },
          {
            "name": "body",
            "in": "query",
            "schema": {
              "type": "string",
              "maxLength": 2000
            },
            "description": "Full-text search restricted to the parsed text body."
          },
          {
            "name": "domain_id",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "description": "Filter by domain ID."
          },
          {
            "name": "reply_to_sent_email_id",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "description": "Filter to inbound emails that are replies to a specific\noutbound send. The value is a `sent_emails.id` (UUID). At\ninbound ingest, Primitive matches the parsed In-Reply-To\nheader (or References as a fallback) against\n`sent_emails.message_id` in the same org and records the\nresolved id on `emails.reply_to_sent_email_id`. This filter\nis the strict-threading lookup behind `primitive chat` and\nany UI that wants to show the inbound reply to a given\nsend. NULL on inbound that isn't a threaded reply to one\nof your sends, so existing emails received before this\ningestion landed will not match.\n"
          },
          {
            "name": "status",
            "in": "query",
            "schema": {
              "$ref": "#/components/schemas/EmailStatus"
            },
            "description": "Filter by inbound email lifecycle status."
          },
          {
            "name": "date_from",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "description": "Filter emails received on or after this timestamp."
          },
          {
            "name": "date_to",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "description": "Filter emails received on or before this timestamp."
          },
          {
            "name": "has_attachment",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "true",
                "false"
              ]
            },
            "description": "Filter by whether the email has one or more attachments."
          },
          {
            "name": "spam_score_lt",
            "in": "query",
            "schema": {
              "type": "number"
            },
            "description": "Filter to emails with spam score below this value."
          },
          {
            "name": "spam_score_gte",
            "in": "query",
            "schema": {
              "type": "number"
            },
            "description": "Filter to emails with spam score greater than or equal to this value."
          },
          {
            "name": "sort",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "relevance",
                "received_at_desc",
                "received_at_asc"
              ]
            },
            "description": "Sort mode. Defaults to relevance when a text query is present,\notherwise `received_at_desc`.\n"
          },
          {
            "name": "cursor",
            "in": "query",
            "schema": {
              "type": "string",
              "maxLength": 200
            },
            "description": "Opaque pagination cursor from a previous search response."
          },
          {
            "$ref": "#/components/parameters/Limit"
          },
          {
            "name": "snippet",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "true",
                "false"
              ],
              "default": "true"
            },
            "description": "Include subject/body highlight snippets when text search is active."
          },
          {
            "name": "include_facets",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "true",
                "false"
              ],
              "default": "true"
            },
            "description": "Include facet counts for sender, domain, status, and attachment presence."
          }
        ],
        "responses": {
          "200": {
            "description": "Search results",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "type": "array",
                          "items": {
                            "$ref": "#/components/schemas/EmailSearchResult"
                          }
                        },
                        "meta": {
                          "$ref": "#/components/schemas/EmailSearchMeta"
                        },
                        "facets": {
                          "$ref": "#/components/schemas/EmailSearchFacets"
                        }
                      },
                      "required": [
                        "data",
                        "meta"
                      ]
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "504": {
            "description": "Search query timed out",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    "/emails/{id}": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "get": {
        "operationId": "getEmail",
        "summary": "Get inbound email by id",
        "description": "Returns the full record for an inbound email received at one\nof your verified domains, including the parsed text and HTML\nbodies, threading metadata, SMTP envelope detail, webhook\ndelivery state, and a `replies` array for any outbound sends\nrecorded as replies to this inbound.\n\nFor listing inbound emails (with cursor pagination, status\nand date filters, and free-text search), use\n`/emails`. Outbound (sent) email records are NOT returned\nhere; use `/sent-emails/{id}` for those.\n\nThe response carries four sender-shaped fields whose\nmeanings overlap. `from_email` is the canonical \"who sent\nthis\" field for most use cases (parsed bare address from\nthe `From:` header, with a `sender` fallback). `from_header`\nis the raw header including any display name. `sender` and\n`smtp_mail_from` both carry the SMTP envelope MAIL FROM\n(return-path) and are equal by construction; `sender` is\nthe older field name retained for compatibility. See\n`primitive describe emails:get-email | jq '.responseSchema.properties'`\nfor per-field detail.\n",
        "tags": [
          "Emails"
        ],
        "responses": {
          "200": {
            "description": "Email details",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/EmailDetail"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      },
      "delete": {
        "operationId": "deleteEmail",
        "summary": "Delete an email",
        "tags": [
          "Emails"
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/Deleted"
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/emails/{id}/raw": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "get": {
        "operationId": "downloadRawEmail",
        "summary": "Download raw email",
        "description": "Downloads the raw RFC 822 email file (.eml). Authenticates via\na signed download token (provided in webhook payloads) or a\nvalid session.\n",
        "tags": [
          "Emails"
        ],
        "security": [
          {
            "BearerAuth": []
          },
          {
            "DownloadToken": []
          }
        ],
        "parameters": [
          {
            "name": "token",
            "in": "query",
            "schema": {
              "type": "string"
            },
            "description": "Signed download token from webhook payload"
          }
        ],
        "responses": {
          "200": {
            "description": "Raw email file",
            "content": {
              "message/rfc822": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            },
            "headers": {
              "Content-Disposition": {
                "schema": {
                  "type": "string",
                  "example": "attachment; filename=\"email-id.eml\""
                }
              },
              "X-Content-SHA256": {
                "schema": {
                  "type": "string"
                },
                "description": "SHA-256 hex digest of the file"
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/emails/{id}/attachments.tar.gz": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "get": {
        "operationId": "downloadAttachments",
        "summary": "Download email attachments",
        "description": "Downloads all attachments as a gzip-compressed tar archive.\nAuthenticates via a signed download token (provided in webhook\npayloads) or a valid session.\n",
        "tags": [
          "Emails"
        ],
        "security": [
          {
            "BearerAuth": []
          },
          {
            "DownloadToken": []
          }
        ],
        "parameters": [
          {
            "name": "token",
            "in": "query",
            "schema": {
              "type": "string"
            },
            "description": "Signed download token from webhook payload"
          }
        ],
        "responses": {
          "200": {
            "description": "Attachments archive",
            "content": {
              "application/gzip": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            },
            "headers": {
              "Content-Disposition": {
                "schema": {
                  "type": "string",
                  "example": "attachment; filename=\"email-id_attachments.tar.gz\""
                }
              },
              "X-Content-SHA256": {
                "schema": {
                  "type": "string"
                },
                "description": "SHA-256 hex digest of the archive"
              },
              "X-Attachment-Count": {
                "schema": {
                  "type": "string"
                },
                "description": "Number of attachments in the archive"
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/emails/{id}/reply": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "post": {
        "operationId": "replyToEmail",
        "summary": "Reply to an inbound email",
        "description": "Sends an outbound reply to the inbound email identified by `id`.\nThreading headers (`In-Reply-To`, `References`), recipient\nderivation (Reply-To, then From, then bare sender), and the\n`Re:` subject prefix are all derived server-side from the\nstored inbound row. The request body carries only the message\nbody, optional From override, optional attachments, and optional\n`wait` flag; passing any header or recipient override is\nrejected by the schema (`additionalProperties: false`).\n\nForwards through the same gates as `/send-mail`: the response\nstatus, error envelope, and `idempotent_replay` flag mirror\nthe send-mail contract verbatim.\n",
        "servers": [
          {
            "url": "https://api.primitive.dev/v1",
            "description": "Attachments-supporting send host (recommended)"
          },
          {
            "url": "https://www.primitive.dev/api/v1",
            "description": "Primary host (attachment-free replies only)"
          }
        ],
        "tags": [
          "Sending"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ReplyInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Outbound relay result",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/SendMailResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "422": {
            "description": "Inbound is not repliable: the row exists but lacks a\n`message_id` (no thread anchor) or a `recipient` (cannot\nderive the From address).\n",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                },
                "example": {
                  "success": false,
                  "error": {
                    "code": "inbound_not_repliable",
                    "message": "inbound has no Message-ID; cannot anchor a reply thread"
                  }
                }
              }
            }
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          },
          "500": {
            "$ref": "#/components/responses/InternalError"
          },
          "502": {
            "$ref": "#/components/responses/BadGateway"
          },
          "503": {
            "$ref": "#/components/responses/ServiceUnavailable"
          }
        }
      }
    },
    "/emails/{id}/replay": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "post": {
        "operationId": "replayEmailWebhooks",
        "summary": "Replay email webhooks",
        "description": "Re-delivers the webhook payload for this email to all active\nendpoints matching the email's domain. Rate limited per-email\n(short cooldown between successive replays of the same email)\nand per-org (burst + sustained windows), sharing an org-wide\nbudget with delivery replays.\n",
        "tags": [
          "Emails"
        ],
        "responses": {
          "200": {
            "description": "Replay result",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/ReplayResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      }
    },
    "/emails/{id}/discard-content": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "post": {
        "operationId": "discardEmailContent",
        "summary": "Discard email content",
        "description": "Permanently deletes the email's raw bytes, parsed body (text + HTML),\nand attachments while preserving metadata (sender, recipient,\nsubject, timestamps, hashes, attachment manifest) for audit logs.\nIdempotent: a second call returns success with\n`already_discarded: true` and does no work.\n\n**Gated** on the customer's discard-content opt-in (managed in the\ndashboard at Settings > Webhooks). When the toggle is off, this\nendpoint returns `403` with code `discard_not_enabled` and a\nmessage pointing the human at the dashboard. There is intentionally\nno API to flip this toggle. Opting in to a destructive,\nnon-reversible operation must be a deliberate human click in the\nUI.\n",
        "tags": [
          "Emails"
        ],
        "responses": {
          "200": {
            "description": "Discard result",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/DiscardContentResult"
                        }
                      },
                      "required": [
                        "data"
                      ]
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          },
          "500": {
            "$ref": "#/components/responses/InternalError"
          }
        }
      }
    },
    "/emails/{id}/conversation": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "get": {
        "operationId": "getConversation",
        "summary": "Get the conversation an email belongs to",
        "description": "Returns the full conversation the given inbound email belongs\nto, as ordered, ready-to-prompt turns WITH bodies. It resolves\nthe thread from the email and returns every message oldest-first,\nso an agent that received an email can pass `messages` straight\nto a chat model in one call instead of walking `/threads/{id}`\nplus `/emails/{id}` and `/sent-emails/{id}` per message.\n\nEach message carries a `direction` (`inbound` | `outbound`) and a\nderived `role`: `inbound` -> `user`, `outbound` -> `assistant`\n(your own prior replies). The role mapping assumes the caller\nowns the outbound side, which is the agent-reply case this exists\nfor. If the email has no thread yet (a brand-new message), the\nconversation is just that one message as a single user turn.\n\nThe message list is capped; check `truncated` to detect when\nolder messages were omitted. Consecutive same-role turns are not\nmerged here; that normalization is model-specific and left to the\ncaller.\n",
        "tags": [
          "Emails"
        ],
        "responses": {
          "200": {
            "description": "Conversation",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/Conversation"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/endpoints": {
      "get": {
        "operationId": "listEndpoints",
        "summary": "List webhook endpoints",
        "description": "Returns all active (non-deleted) webhook endpoints.",
        "tags": [
          "Endpoints"
        ],
        "responses": {
          "200": {
            "description": "List of endpoints",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "type": "array",
                          "items": {
                            "$ref": "#/components/schemas/Endpoint"
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          }
        }
      },
      "post": {
        "operationId": "createEndpoint",
        "summary": "Create a webhook endpoint",
        "description": "Creates a new webhook endpoint. If a deactivated endpoint\nwith the same URL and domain exists, it is reactivated\ninstead. Subject to plan limits on the number of active\nendpoints.\n\n**Signing is account-scoped, not per-endpoint.** This call\ndoes not return any signing material; every endpoint on the\naccount uses the same webhook secret, fetched via\n`GET /account/webhook-secret`. See the API-level \"Webhook\nsigning\" section for the full wire format (header name,\nsigned string, hash algo, secret format, tolerance) and a\nlanguage-agnostic verification recipe.\n\nAfter creating the endpoint, fire a test delivery against\nit via `POST /endpoints/{id}/test` to confirm your verifier\naccepts the signature.\n",
        "tags": [
          "Endpoints"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateEndpointInput"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Endpoint created (or reactivated)",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/Endpoint"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          }
        }
      }
    },
    "/endpoints/{id}": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "patch": {
        "operationId": "updateEndpoint",
        "summary": "Update a webhook endpoint",
        "description": "Updates an active webhook endpoint. If the URL is changed, the old\nendpoint is deactivated and a new one is created (or an existing\ndeactivated endpoint with the new URL is reactivated).\n",
        "tags": [
          "Endpoints"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateEndpointInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Updated endpoint",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/Endpoint"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      },
      "delete": {
        "operationId": "deleteEndpoint",
        "summary": "Delete a webhook endpoint",
        "description": "Soft-deletes a webhook endpoint. The endpoint will no longer\nreceive webhook deliveries.\n",
        "tags": [
          "Endpoints"
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/Deleted"
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/endpoints/{id}/test": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "post": {
        "operationId": "testEndpoint",
        "summary": "Send a test webhook",
        "description": "Sends a sample `email.received` event to the endpoint. The request\nincludes SSRF protection (private IP rejection and DNS pinning).\nRate limited to 4 per minute and 30 per hour (non-exempt).\nSuccessful deliveries and verified-domain endpoints are exempt\nfrom the rate limit.\n",
        "tags": [
          "Endpoints"
        ],
        "responses": {
          "200": {
            "description": "Test result",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/TestResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      }
    },
    "/filters": {
      "get": {
        "operationId": "listFilters",
        "summary": "List filter rules",
        "description": "Returns all whitelist and blocklist filter rules.",
        "tags": [
          "Filters"
        ],
        "responses": {
          "200": {
            "description": "List of filters",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "type": "array",
                          "items": {
                            "$ref": "#/components/schemas/Filter"
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          }
        }
      },
      "post": {
        "operationId": "createFilter",
        "summary": "Create a filter rule",
        "description": "Creates a new whitelist or blocklist filter. Per-domain filters\nrequire a Pro plan. Patterns are stored as lowercase.\n",
        "tags": [
          "Filters"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateFilterInput"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Filter created",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/Filter"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/filters/{id}": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "patch": {
        "operationId": "updateFilter",
        "summary": "Update a filter rule",
        "description": "Toggle a filter's enabled state.",
        "tags": [
          "Filters"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateFilterInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Updated filter",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/Filter"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      },
      "delete": {
        "operationId": "deleteFilter",
        "summary": "Delete a filter rule",
        "tags": [
          "Filters"
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/Deleted"
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/webhooks/deliveries": {
      "get": {
        "operationId": "listDeliveries",
        "summary": "List webhook deliveries",
        "description": "Returns a paginated list of webhook delivery attempts. Each delivery\nincludes a nested `email` object with sender, recipient, and subject.\n",
        "tags": [
          "Webhook Deliveries"
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/Cursor"
          },
          {
            "$ref": "#/components/parameters/Limit"
          },
          {
            "name": "email_id",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "description": "Filter by email ID"
          },
          {
            "name": "status",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "pending",
                "delivered",
                "header_confirmed",
                "failed"
              ]
            },
            "description": "Filter by delivery status"
          },
          {
            "name": "date_from",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "description": "Filter deliveries created on or after this timestamp"
          },
          {
            "name": "date_to",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "description": "Filter deliveries created on or before this timestamp"
          }
        ],
        "responses": {
          "200": {
            "description": "Paginated list of deliveries",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/ListEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "type": "array",
                          "items": {
                            "$ref": "#/components/schemas/DeliverySummary"
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          }
        }
      }
    },
    "/webhooks/deliveries/{id}/replay": {
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string",
            "pattern": "^\\d+$"
          },
          "description": "Delivery ID (numeric)"
        }
      ],
      "post": {
        "operationId": "replayDelivery",
        "summary": "Replay a webhook delivery",
        "description": "Re-sends the stored webhook payload from a previous delivery attempt.\nIf the original endpoint is still active, it is targeted. If the\noriginal endpoint was deleted, the oldest active endpoint is used.\nDeactivated endpoints cannot be replayed to. Rate limited per-org,\nsharing an org-wide budget with email replays.\n",
        "tags": [
          "Webhook Deliveries"
        ],
        "responses": {
          "200": {
            "description": "Replay result",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/ReplayResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      }
    },
    "/send-permissions": {
      "get": {
        "operationId": "getSendPermissions",
        "summary": "List send-permission rules",
        "description": "Returns a flat list of rules describing every recipient the\ncaller may send to. Each rule has a `type`, a kind-specific\npayload, and a human-readable `description`. If any rule\nmatches the recipient, /send-mail will accept the send under\nthe recipient-scope check.\n\nThe endpoint is the answer to \"where can I send\" without\nexposing internal entitlement names. Agents that don't\nrecognize a `type` can still read the `description` prose\nand act on it.\n\nRule kinds, ordered broadest-first so an agent can stop\nscanning at the first match:\n\n  1. `any_recipient` (one entry, only when the org can send\n     anywhere): every other rule below it is redundant.\n  2. `managed_zone` (always emitted, one per Primitive-managed\n     zone): sends to any address at *.primitive.email or\n     *.email.works always succeed; no entitlement required.\n  3. `your_domain` (one per active verified outbound domain\n     owned by the org): sends to that domain are approved.\n  4. `address` (one per address that has authenticated\n     inbound mail to the org, capped at `meta.address_cap`):\n     sends to that exact address are approved.\n\nThe list is informational, not an authorization check.\n/send-mail remains the source of truth on whether an\nindividual send will succeed (it also enforces the\nfrom-address and the `send_mail` entitlement, which are\nnot recipient-scope concerns and are not represented here).\n",
        "tags": [
          "Sending"
        ],
        "responses": {
          "200": {
            "description": "Send-permission rules for the caller's org",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "type": "array",
                          "items": {
                            "$ref": "#/components/schemas/SendPermissionRule"
                          }
                        },
                        "meta": {
                          "$ref": "#/components/schemas/SendPermissionsMeta"
                        }
                      },
                      "required": [
                        "data",
                        "meta"
                      ]
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          }
        }
      }
    },
    "/send-mail": {
      "post": {
        "operationId": "sendEmail",
        "summary": "Send outbound email",
        "description": "Sends an outbound email through Primitive's outbound relay. By default\nthe request returns once the relay accepts the message for delivery.\nSet `wait: true` to wait for the first downstream SMTP delivery outcome.\n\n**Host routing.** /send-mail is served by the attachments-\nsupporting host (`https://api.primitive.dev/v1`) so the\nrequest body can carry inline attachments up to ~30 MiB raw.\nThe primary host (`https://www.primitive.dev/api/v1`) also\naccepts /send-mail for attachment-free sends; sends WITH\nattachments to the primary host return 413\n`attachments_unsupported_on_this_endpoint`. The typed SDKs\nroute /send-mail to the attachments host automatically.\n",
        "servers": [
          {
            "url": "https://api.primitive.dev/v1",
            "description": "Attachments-supporting send host (recommended)"
          },
          {
            "url": "https://www.primitive.dev/api/v1",
            "description": "Primary host (attachment-free sends only)"
          }
        ],
        "tags": [
          "Sending"
        ],
        "parameters": [
          {
            "name": "Idempotency-Key",
            "in": "header",
            "required": false,
            "schema": {
              "type": "string",
              "minLength": 1,
              "maxLength": 255,
              "pattern": "^[\\x21-\\x7E]+$"
            },
            "description": "Optional customer-supplied idempotency key. If omitted, Primitive\nderives one from the canonical request payload and echoes the\neffective value in the `Idempotency-Key` response header.\n"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SendMailInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Outbound relay result",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/SendMailResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          },
          "500": {
            "$ref": "#/components/responses/InternalError"
          },
          "502": {
            "$ref": "#/components/responses/BadGateway"
          },
          "503": {
            "$ref": "#/components/responses/ServiceUnavailable"
          }
        }
      }
    },
    "/semantic-search": {
      "post": {
        "operationId": "semanticSearch",
        "summary": "Semantic search across received and sent mail",
        "description": "Ranked search across both received and sent mail. The `mode`\nfield selects the ranking strategy:\n\n- `keyword`: lexical full-text matching only (no embeddings).\n- `semantic`: meaning-based matching using vector embeddings.\n- `hybrid` (default): blends the semantic and keyword signals.\n\nResults are ordered by a relevance `score`. Every row reports the\nfields it matched (`matched_fields`), a match-centered excerpt per\nfield (`snippets`), and a `score_breakdown` whose components account\nfor the `score`. Page through results by passing the prior\nresponse's `meta.cursor` back as `cursor`.\n\nRequires the Pro plan and the `semantic_search_enabled`\nentitlement; callers without them receive `403`.\n\nHost routing: this operation is served only by the search host\n(`https://api.primitive.dev/v1`). The typed SDKs route it there\nautomatically.\n",
        "servers": [
          {
            "url": "https://api.primitive.dev/v1",
            "description": "Search host"
          }
        ],
        "tags": [
          "Search"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SemanticSearchInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Ranked search results",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "type": "array",
                          "items": {
                            "$ref": "#/components/schemas/SemanticSearchResult"
                          }
                        },
                        "meta": {
                          "$ref": "#/components/schemas/SemanticSearchMeta"
                        }
                      },
                      "required": [
                        "data",
                        "meta"
                      ]
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          },
          "500": {
            "$ref": "#/components/responses/InternalError"
          },
          "503": {
            "$ref": "#/components/responses/ServiceUnavailable"
          }
        }
      }
    },
    "/sent-emails": {
      "get": {
        "operationId": "listSentEmails",
        "summary": "List outbound sent emails",
        "description": "Returns a paginated list of OUTBOUND emails the caller's\norg has sent via /send-mail (and /emails/{id}/reply, which\nforwards through /send-mail). Includes every recorded\nattempt, including gate-denied attempts that the agent\nnever called and rows still in `queued` state.\n\nFor inbound mail received at your verified domains, see\n/emails. There is no unified send/receive history endpoint;\nthe two surfaces are intentionally separate because the\nunderlying tables, statuses, and lifecycle differ.\n\nEmail bodies (`body_text`, `body_html`) are NOT included on\nlist rows so a 50-row page can't balloon into a multi-MB\nresponse when sends are near the 5MB body cap. Use\n/sent-emails/{id} to fetch a single row with bodies, or\ncross-reference by `client_idempotency_key` if the caller\nalready has the body locally.\n",
        "tags": [
          "Sending"
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/Cursor"
          },
          {
            "$ref": "#/components/parameters/Limit"
          },
          {
            "name": "status",
            "in": "query",
            "schema": {
              "$ref": "#/components/schemas/SentEmailStatus"
            },
            "description": "Filter to rows in this status. Useful for polling\nqueued rows that haven't transitioned, auditing\ngate-denied attempts, or listing only successful\ndeliveries.\n"
          },
          {
            "name": "request_id",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "description": "Filter to the row matching a specific server-issued\n`request_id`. The /send-mail response surfaces\n`request_id` on every send; this lookup lets the\ncaller find the historical row for a given live call\nwithout remembering its `id`.\n"
          },
          {
            "name": "idempotency_key",
            "in": "query",
            "schema": {
              "type": "string",
              "minLength": 1,
              "maxLength": 255
            },
            "description": "Filter to rows with the given `client_idempotency_key`.\nMultiple rows can share a key (a retry that hit the\nidempotent-replay path returns the same row, but a\nretry with a DIFFERENT canonical payload under the\nsame key is rejected by /send-mail before the row is\nwritten, so duplicates are bounded).\n"
          },
          {
            "name": "date_from",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "description": "Inclusive lower bound on `created_at`."
          },
          {
            "name": "date_to",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "description": "Inclusive upper bound on `created_at`."
          }
        ],
        "responses": {
          "200": {
            "description": "Page of sent-email summaries",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/ListEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "type": "array",
                          "items": {
                            "$ref": "#/components/schemas/SentEmailSummary"
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          }
        }
      }
    },
    "/sent-emails/{id}": {
      "get": {
        "operationId": "getSentEmail",
        "summary": "Get a sent email by id",
        "description": "Returns the full sent-email record by id, including\n`body_text` and `body_html` (omitted from the listing\nendpoint to keep paginated responses small). Use this when\ndiagnosing a specific send, e.g. inspecting the receiver's\nSMTP response on a `bounced` row or pulling the gate\ndenial detail on a `gate_denied` row.\n",
        "tags": [
          "Sending"
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/ResourceId"
          }
        ],
        "responses": {
          "200": {
            "description": "Sent-email detail",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/SentEmailDetail"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/threads/{id}": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "get": {
        "operationId": "getThread",
        "summary": "Get a conversation thread by id",
        "description": "Returns a conversation thread: its metadata plus the inbound\nand outbound messages that belong to it, interleaved in time\norder (oldest first). A thread spans both received emails and\nyour sends, so an agent can reconstruct an entire back-and-forth\nfrom one call instead of walking reply headers.\n\nEach message carries a `direction` (`inbound` | `outbound`) and\nan `id`; fetch the full message via `/emails/{id}` or\n`/sent-emails/{id}` accordingly. Bodies are omitted here to keep\nthe thread view lightweight.\n\nDiscover a thread id from the `thread_id` field on any email or\nsent-email (list or detail). The message list is capped; compare\n`message_count` against `messages.length` to detect truncation.\n",
        "tags": [
          "Threads"
        ],
        "responses": {
          "200": {
            "description": "Thread detail",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/Thread"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/functions": {
      "get": {
        "operationId": "listFunctions",
        "summary": "List functions",
        "description": "Returns every active (non-deleted) function in the org, newest\nfirst. Each entry carries deploy status and timestamps. To\ninspect the source code or deploy errors, use `GET /functions/{id}`.\n",
        "tags": [
          "Functions"
        ],
        "responses": {
          "200": {
            "description": "List of functions",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "type": "array",
                          "items": {
                            "$ref": "#/components/schemas/FunctionListItem"
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          }
        }
      },
      "post": {
        "operationId": "createFunction",
        "summary": "Deploy a function",
        "description": "Creates and deploys a new function. The handler must be a single\nESM module whose default export is an object with an async\n`fetch(request, env)` method (Workers-style). Primitive signs\neach delivery and forwards the `Primitive-Signature` header to\nthe handler. Verify the raw request body with\n`PRIMITIVE_WEBHOOK_SECRET` before parsing JSON; after verification\nthe request body parses to an `email.received` event (see\n`EmailReceivedEvent` and the Webhook payload section for the full\nschema). Code is bundled before being uploaded; ship a single\nself-contained file rather than relying on external imports.\n\n**Code limits.** `code` is capped at 1 MiB UTF-8. `sourceMap`\n(optional) is capped at 5 MiB UTF-8, stored with each deployment\nattempt, and sent to the runtime so stack traces can resolve to\noriginal source files.\n\n**Auto-wiring.** On successful deploy, Primitive automatically\ncreates a webhook endpoint that delivers inbound mail to the\nfunction. There is nothing to configure on the Endpoints API\nfor this to work; the internal runtime URL is not returned by\nthe API and is not a customer-facing integration surface.\n\n**Secrets.** New functions ship with the managed secrets\n(`PRIMITIVE_WEBHOOK_SECRET`, `PRIMITIVE_API_KEY`,\n`PRIMITIVE_API_BASE_URL`) already bound. Add user-set secrets via\n`POST /functions/{id}/secrets`; secret writes only land in the\nrunning handler on the next redeploy.\n",
        "tags": [
          "Functions"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateFunctionInput"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Function created and deployed",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/CreateFunctionResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "description": "Invalid request parameters or customer-correctable deploy rejection",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "409": {
            "description": "A function with this name already exists in the org",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "424": {
            "$ref": "#/components/responses/DeployFailed"
          },
          "429": {
            "$ref": "#/components/responses/DeployFailed"
          },
          "503": {
            "$ref": "#/components/responses/DeployFailed"
          }
        }
      }
    },
    "/functions/{id}": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "get": {
        "operationId": "getFunction",
        "summary": "Get a function",
        "description": "Returns the full record for a function, including its current\nsource code and the deploy status / error from the most recent\ndeploy attempt.\n",
        "tags": [
          "Functions"
        ],
        "responses": {
          "200": {
            "description": "Function record",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/FunctionDetail"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      },
      "put": {
        "operationId": "updateFunction",
        "summary": "Update and redeploy a function",
        "description": "Replaces the function's source code with the body's `code` and\ntriggers a redeploy. Same size limits as `POST /functions`.\nUse this verb to push secret writes into the running handler:\npassing the same `code` re-runs the deploy and refreshes the\nbinding set with the latest values from the secrets table.\n\nOn deploy failure, the previously-deployed code stays live; the\nruntime never serves a half-built bundle. The response uses\n`error.code` `deploy_failed`, and the function's `deploy_error`\nfield carries the latest deploy error for dashboard/API reads.\n",
        "tags": [
          "Functions"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateFunctionInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Updated function",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/FunctionDetail"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "description": "Invalid request parameters or customer-correctable deploy rejection",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "424": {
            "$ref": "#/components/responses/DeployFailed"
          },
          "429": {
            "$ref": "#/components/responses/DeployFailed"
          },
          "503": {
            "$ref": "#/components/responses/DeployFailed"
          }
        }
      },
      "delete": {
        "operationId": "deleteFunction",
        "summary": "Delete a function",
        "description": "Soft-deletes the function row, removes the script from the edge\nruntime, and deactivates the auto-wired webhook endpoint so no\nfurther inbound mail is delivered. Past deploy history,\ninvocations, and logs are retained.\n\nReturns 502 if the runtime delete fails partway; the function\nrow stays in place and the call is safe to retry until it\nsucceeds.\n",
        "tags": [
          "Functions"
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/Deleted"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "502": {
            "$ref": "#/components/responses/BadGateway"
          }
        }
      }
    },
    "/functions/{id}/test": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "post": {
        "operationId": "testFunction",
        "summary": "Send a test invocation",
        "description": "Sends a real test email from a Primitive-controlled sender to a\nlocal-part on one of the org's verified inbound domains. By\ndefault the recipient is a synthetic\n`__primitive_function_test+<random>@<domain>` address on a\ndomain selected to route to the function. Scoped functions use\ntheir scoped domain; fallback functions use a domain that has\nno enabled domain-scoped endpoint. Pass `local_part` to\noverride and exercise routing logic that branches on a specific\nrecipient (the common pattern when one function handles multiple\ninboxes like `summarize@` and `action@`). The function fires\nthrough the normal MX delivery path, so reply / send-mail calls\nfrom inside the handler against the inbound's `email.id` work\nthe same as in production. Returns immediately after the send is\nqueued; the invocation appears on the function's invocations\nlist within a few seconds.\n\nRequires that the function is currently `deployed`. Returns 422\nif the function is in `pending` or `failed` state, or if the\norg has no verified inbound domain to receive the test mail.\nReturns 400 if `local_part` is set to a value that does not\nmatch the local-part character set.\n",
        "tags": [
          "Functions"
        ],
        "requestBody": {
          "required": false,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "local_part": {
                    "type": "string",
                    "description": "Override the synthetic local-part. When set, the\ntest email is sent to `<local_part>@<picked-domain>`\ninstead of the default\n`__primitive_function_test+<random>@<picked-domain>`.\nMust start with an alphanumeric and contain only\nletters, digits, dots, plus signs, hyphens, or\nunderscores; 1-64 characters total.\n",
                    "minLength": 1,
                    "maxLength": 64,
                    "pattern": "^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$",
                    "example": "summarize"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Test send queued",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/TestInvocationResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "422": {
            "description": "Function not in a state that can be invoked, or no inbound domain configured",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "502": {
            "$ref": "#/components/responses/BadGateway"
          },
          "503": {
            "description": "Sending agent misconfigured",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    "/functions/{id}/test-runs/{run_id}/trace": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        },
        {
          "name": "run_id",
          "in": "path",
          "required": true,
          "description": "Function test run id returned by POST /functions/{id}/test.",
          "schema": {
            "type": "string",
            "format": "uuid"
          }
        }
      ],
      "get": {
        "operationId": "getFunctionTestRunTrace",
        "summary": "Get a function test run trace",
        "description": "Returns the current end-to-end trace for a function test run.\nThe trace is intentionally partial while the test is still in\nflight: callers can poll this endpoint and watch it fill in\nfrom send -> inbound -> webhook deliveries -> outbound\nrequests, logs, and replies.\n",
        "tags": [
          "Functions"
        ],
        "responses": {
          "200": {
            "description": "Function test run trace",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/FunctionTestRunTrace"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/functions/{id}/secrets": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "get": {
        "operationId": "listFunctionSecrets",
        "summary": "List a function's secrets",
        "description": "Returns metadata for every secret bound to the function, with\nmanaged entries (provisioned by Primitive) listed first and\nuser-set entries listed alphabetically after. **Values are\nnever returned.** Secret writes are write-only.\n\nManaged entries (e.g. `PRIMITIVE_WEBHOOK_SECRET`,\n`PRIMITIVE_API_KEY`, `PRIMITIVE_API_BASE_URL`) carry a\n`description` instead of `created_at` / `updated_at`. They\ncannot be created, updated, or deleted via this API.\n",
        "tags": [
          "Functions"
        ],
        "responses": {
          "200": {
            "description": "List of secrets (metadata only, no values)",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "type": "object",
                          "properties": {
                            "items": {
                              "type": "array",
                              "items": {
                                "$ref": "#/components/schemas/FunctionSecretListItem"
                              }
                            }
                          },
                          "required": [
                            "items"
                          ]
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      },
      "post": {
        "operationId": "createFunctionSecret",
        "summary": "Create or update a secret",
        "description": "Idempotent insert-or-update keyed on `(function_id, key)`.\nReturns 201 the first time the key is set, 200 on subsequent\nupdates. Values are encrypted at rest and only become visible\nto the running handler on the next deploy (`PUT /functions/{id}`\nwith the existing code is sufficient to refresh bindings).\n\nKeys must match `^[A-Z_][A-Z0-9_]*$` (uppercase letters,\ndigits, underscores; first character is a letter or\nunderscore). Values are at most 4096 UTF-8 bytes. System-\nmanaged keys are reserved and rejected.\n",
        "tags": [
          "Functions"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateFunctionSecretInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Secret updated",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/FunctionSecretWriteResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "201": {
            "description": "Secret created",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/FunctionSecretWriteResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/functions/{id}/secrets/{key}": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        },
        {
          "name": "key",
          "in": "path",
          "required": true,
          "description": "Secret key. Must match `^[A-Z_][A-Z0-9_]*$`.",
          "schema": {
            "type": "string",
            "pattern": "^[A-Z_][A-Z0-9_]*$"
          }
        }
      ],
      "put": {
        "operationId": "setFunctionSecret",
        "summary": "Set a secret by key",
        "description": "Path-keyed companion to `POST /functions/{id}/secrets`.\nIdempotent: returns 201 the first time the key is set, 200 on\nsubsequent updates. Same validation rules and same write-only\nguarantees as the POST verb; the new value lands in the running\nhandler on the next deploy.\n",
        "tags": [
          "Functions"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SetFunctionSecretInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Secret updated",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/FunctionSecretWriteResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "201": {
            "description": "Secret created",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/FunctionSecretWriteResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      },
      "delete": {
        "operationId": "deleteFunctionSecret",
        "summary": "Delete a secret",
        "description": "Removes the secret. The binding stays live in the running\nhandler until the next deploy refreshes the binding set\n(`PUT /functions/{id}` with the existing code is sufficient).\nReturns 404 if the key did not exist. Managed system keys\ncannot be deleted.\n",
        "tags": [
          "Functions"
        ],
        "responses": {
          "204": {
            "description": "Secret deleted"
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/functions/{id}/logs": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "get": {
        "operationId": "listFunctionLogs",
        "summary": "List a function's execution logs",
        "description": "Returns the most recent `function_logs` rows for the function,\nnewest first. Each row is a single `console.log` / `console.error`\ninvocation captured from the running handler.\n\nPage through history with the opaque `cursor` returned as\n`next_cursor`; pass it back as the `cursor` query param on the\nnext call. `next_cursor` is `null` when there are no further\nrows. The cursor format is an implementation detail and should\nnot be parsed by callers.\n",
        "tags": [
          "Functions"
        ],
        "parameters": [
          {
            "name": "limit",
            "in": "query",
            "required": false,
            "description": "Maximum number of rows to return. Clamped to 1..200; default\n50.\n",
            "schema": {
              "type": "integer",
              "minimum": 1,
              "maximum": 200,
              "default": 50
            }
          },
          {
            "name": "cursor",
            "in": "query",
            "required": false,
            "description": "Opaque pagination cursor from a previous response's\n`next_cursor`. Omit on the first call.\n",
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "List of log rows (newest first) plus pagination cursor.",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "data": {
                          "type": "object",
                          "properties": {
                            "items": {
                              "type": "array",
                              "items": {
                                "$ref": "#/components/schemas/FunctionLogRow"
                              }
                            },
                            "next_cursor": {
                              "type": [
                                "string",
                                "null"
                              ],
                              "description": "Pass back as `cursor` to fetch the next\npage. `null` when no further rows exist.\n"
                            }
                          },
                          "required": [
                            "items",
                            "next_cursor"
                          ]
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ValidationError"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "BearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "description": "API key with `prim_` prefix: `Authorization: Bearer prim_<key>`"
      },
      "DownloadToken": {
        "type": "apiKey",
        "in": "query",
        "name": "token",
        "description": "Signed download token provided in webhook payloads"
      }
    },
    "parameters": {
      "ResourceId": {
        "name": "id",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "format": "uuid"
        },
        "description": "Resource UUID"
      },
      "Cursor": {
        "name": "cursor",
        "in": "query",
        "schema": {
          "type": "string"
        },
        "description": "Pagination cursor from a previous response's `meta.cursor` field.\nFormat: `{ISO-datetime}|{id}`\n"
      },
      "Limit": {
        "name": "limit",
        "in": "query",
        "schema": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100,
          "default": 50
        },
        "description": "Number of results per page"
      }
    },
    "responses": {
      "Unauthorized": {
        "description": "Invalid or missing API key",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            },
            "example": {
              "success": false,
              "error": {
                "code": "unauthorized",
                "message": "Invalid or missing API key"
              }
            }
          }
        }
      },
      "Forbidden": {
        "description": "Authenticated caller lacks permission for the operation",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            },
            "example": {
              "success": false,
              "error": {
                "code": "forbidden",
                "message": "Insufficient permissions"
              }
            }
          }
        }
      },
      "NotFound": {
        "description": "Resource not found",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            },
            "example": {
              "success": false,
              "error": {
                "code": "not_found",
                "message": "Resource not found"
              }
            }
          }
        }
      },
      "ValidationError": {
        "description": "Invalid request parameters",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            },
            "example": {
              "success": false,
              "error": {
                "code": "validation_error",
                "message": "Invalid domain format"
              }
            }
          }
        }
      },
      "DeployFailed": {
        "description": "Function deploy could not be completed; previously deployed code remains live",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            },
            "example": {
              "success": false,
              "error": {
                "code": "deploy_failed",
                "message": "Function deploy failed"
              }
            }
          }
        }
      },
      "RateLimited": {
        "description": "Rate limit exceeded",
        "headers": {
          "Retry-After": {
            "schema": {
              "type": "integer"
            },
            "description": "Seconds to wait before retrying"
          }
        },
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            },
            "example": {
              "success": false,
              "error": {
                "code": "rate_limit_exceeded",
                "message": "Rate limit exceeded"
              }
            }
          }
        }
      },
      "BadGateway": {
        "description": "Primitive could not complete the downstream SMTP request",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            },
            "example": {
              "success": false,
              "error": {
                "code": "outbound_unreachable",
                "message": "Outbound SMTP service request failed"
              }
            }
          }
        }
      },
      "ServiceUnavailable": {
        "description": "Primitive is temporarily unable to process the request",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            },
            "example": {
              "success": false,
              "error": {
                "code": "outbound_capacity_exhausted",
                "message": "Outbound capacity is temporarily exhausted"
              }
            }
          }
        }
      },
      "InternalError": {
        "description": "Primitive encountered an internal error",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            },
            "example": {
              "success": false,
              "error": {
                "code": "internal_error",
                "message": "Internal server error"
              }
            }
          }
        }
      },
      "Deleted": {
        "description": "Resource deleted",
        "content": {
          "application/json": {
            "schema": {
              "allOf": [
                {
                  "$ref": "#/components/schemas/SuccessEnvelope"
                },
                {
                  "type": "object",
                  "properties": {
                    "data": {
                      "type": "object",
                      "properties": {
                        "deleted": {
                          "type": "boolean",
                          "const": true
                        }
                      },
                      "required": [
                        "deleted"
                      ]
                    }
                  }
                }
              ]
            }
          }
        }
      }
    },
    "schemas": {
      "SuccessEnvelope": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean",
            "const": true
          }
        },
        "required": [
          "success",
          "data"
        ]
      },
      "ListEnvelope": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean",
            "const": true
          },
          "meta": {
            "$ref": "#/components/schemas/PaginationMeta"
          }
        },
        "required": [
          "success",
          "data",
          "meta"
        ]
      },
      "PaginationMeta": {
        "type": "object",
        "properties": {
          "total": {
            "type": "integer",
            "description": "Total number of matching records"
          },
          "limit": {
            "type": "integer",
            "description": "Page size used for this request"
          },
          "cursor": {
            "type": [
              "string",
              "null"
            ],
            "description": "Cursor for the next page, or null if no more results"
          }
        },
        "required": [
          "total",
          "limit",
          "cursor"
        ]
      },
      "ErrorResponse": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean",
            "const": false
          },
          "error": {
            "type": "object",
            "properties": {
              "code": {
                "type": "string",
                "enum": [
                  "unauthorized",
                  "forbidden",
                  "not_found",
                  "validation_error",
                  "rate_limit_exceeded",
                  "internal_error",
                  "conflict",
                  "mx_conflict",
                  "outbound_disabled",
                  "cannot_send_from_domain",
                  "recipient_not_allowed",
                  "outbound_key_missing",
                  "outbound_unreachable",
                  "outbound_key_invalid",
                  "outbound_capacity_exhausted",
                  "outbound_response_malformed",
                  "outbound_relay_failed",
                  "discard_not_enabled",
                  "inbound_not_repliable",
                  "search_timeout",
                  "authorization_pending",
                  "slow_down",
                  "access_denied",
                  "expired_token",
                  "invalid_device_code",
                  "invalid_signup_code",
                  "invalid_signup_token",
                  "invalid_verification_code",
                  "email_delivery_failed",
                  "clerk_signup_failed",
                  "no_orgs_for_user",
                  "org_not_accessible"
                ]
              },
              "message": {
                "type": "string"
              },
              "details": {
                "type": "object",
                "description": "Optional structured data that callers can inspect to recover\nfrom the error. The fields present depend on `code`. Additional\nkeys may be added over time without a major-version bump.\n",
                "additionalProperties": true,
                "properties": {
                  "mx_conflict": {
                    "type": "object",
                    "description": "Present when `code == mx_conflict`.",
                    "required": [
                      "provider_name",
                      "suggested_subdomain"
                    ],
                    "properties": {
                      "provider_name": {
                        "type": "string",
                        "description": "Human-readable name of the detected mailbox provider (e.g. \"Google Workspace\")."
                      },
                      "suggested_subdomain": {
                        "type": "string",
                        "description": "Subdomain to try instead (e.g. \"mail\" for `mail.example.com`)."
                      }
                    }
                  },
                  "required_entitlements": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "Entitlements that would allow a denied send when no recipient-scope gate was granted."
                  },
                  "sent_email_id": {
                    "type": "string",
                    "description": "ID of the persisted sent-email attempt associated with the error."
                  },
                  "content_hash": {
                    "type": "string",
                    "description": "Content hash of the original request on idempotency cache-hit errors."
                  },
                  "client_idempotency_key": {
                    "type": "string",
                    "description": "Effective idempotency key associated with the original request."
                  }
                }
              },
              "gates": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/GateDenial"
                },
                "description": "Structured per-gate denial detail for recipient-scope send-mail failures."
              },
              "request_id": {
                "type": "string",
                "description": "Server-issued request identifier for support and tracing."
              }
            },
            "required": [
              "code",
              "message"
            ]
          }
        },
        "required": [
          "success",
          "error"
        ]
      },
      "GateDenial": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "enum": [
              "send_to_confirmed_domains",
              "send_to_known_addresses"
            ],
            "description": "Public recipient-scope gate name that denied the send."
          },
          "reason": {
            "type": "string",
            "enum": [
              "domain_not_confirmed",
              "recipient_unauthenticated",
              "recipient_not_known"
            ],
            "description": "Stable machine-readable denial reason."
          },
          "message": {
            "type": "string",
            "description": "Human-readable explanation of the gate denial."
          },
          "subject": {
            "type": "string",
            "description": "Domain or address the gate evaluated."
          },
          "fix": {
            "$ref": "#/components/schemas/GateFix"
          },
          "docs_url": {
            "type": "string",
            "description": "Public docs URL with more context."
          }
        },
        "required": [
          "name",
          "reason",
          "message",
          "subject"
        ]
      },
      "GateFix": {
        "type": "object",
        "properties": {
          "action": {
            "type": "string",
            "enum": [
              "confirm_domain",
              "sender_must_fix_authentication",
              "wait_for_inbound"
            ],
            "description": "Suggested next action for the caller."
          },
          "subject": {
            "type": "string",
            "description": "Entity the action applies to."
          }
        },
        "required": [
          "action",
          "subject"
        ]
      },
      "StartCliLoginInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "device_name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 80,
            "description": "Human-readable device name shown during browser approval"
          },
          "metadata": {
            "type": "object",
            "additionalProperties": true,
            "description": "Optional client metadata stored with the login session; serialized JSON must be 2048 bytes or fewer"
          }
        }
      },
      "CliLoginStartResult": {
        "type": "object",
        "properties": {
          "device_code": {
            "type": "string",
            "description": "Opaque code used by the CLI to poll for approval"
          },
          "user_code": {
            "type": "string",
            "pattern": "^[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}$",
            "description": "Short code the user confirms in the browser"
          },
          "verification_uri": {
            "type": "string",
            "description": "Browser URL where the user approves the login"
          },
          "verification_uri_complete": {
            "type": "string",
            "description": "Browser URL with the user code prefilled"
          },
          "expires_in": {
            "type": "integer",
            "description": "Seconds until the login session expires"
          },
          "interval": {
            "type": "integer",
            "description": "Minimum seconds between poll requests"
          }
        },
        "required": [
          "device_code",
          "user_code",
          "verification_uri",
          "verification_uri_complete",
          "expires_in",
          "interval"
        ]
      },
      "PollCliLoginInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "device_code": {
            "type": "string",
            "minLength": 1
          }
        },
        "required": [
          "device_code"
        ]
      },
      "CliLoginPollResult": {
        "type": "object",
        "properties": {
          "api_key": {
            "type": "string",
            "description": "Legacy alias for access_token. New CLI builds should persist access_token and refresh_token."
          },
          "key_id": {
            "type": "string",
            "format": "uuid",
            "description": "Legacy alias for oauth_grant_id"
          },
          "key_prefix": {
            "type": "string",
            "description": "Legacy display prefix derived from access_token"
          },
          "access_token": {
            "type": "string",
            "description": "OAuth access token for CLI API authentication"
          },
          "refresh_token": {
            "type": "string",
            "description": "OAuth refresh token used by the CLI to renew access"
          },
          "token_type": {
            "type": "string",
            "enum": [
              "Bearer"
            ]
          },
          "expires_in": {
            "type": "integer",
            "description": "Seconds until access_token expires"
          },
          "auth_method": {
            "type": "string",
            "enum": [
              "oauth"
            ]
          },
          "oauth_grant_id": {
            "type": "string",
            "format": "uuid"
          },
          "oauth_client_id": {
            "type": "string"
          },
          "org_id": {
            "type": "string",
            "format": "uuid"
          },
          "org_name": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "api_key",
          "key_id",
          "key_prefix",
          "access_token",
          "refresh_token",
          "token_type",
          "expires_in",
          "auth_method",
          "oauth_grant_id",
          "oauth_client_id",
          "org_id",
          "org_name"
        ]
      },
      "StartCliSignupInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "email": {
            "type": "string",
            "format": "email",
            "maxLength": 254
          },
          "signup_code": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          },
          "terms_accepted": {
            "type": "boolean",
            "const": true,
            "description": "Must be true to confirm acceptance of Primitive's Terms of Service and Privacy Policy"
          },
          "device_name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 80,
            "description": "Human-readable device name used for the created CLI OAuth grant"
          },
          "metadata": {
            "type": "object",
            "additionalProperties": true,
            "description": "Optional client metadata stored with the signup session; serialized JSON must be 2048 bytes or fewer"
          }
        },
        "required": [
          "email",
          "signup_code",
          "terms_accepted"
        ]
      },
      "CliSignupStartResult": {
        "type": "object",
        "properties": {
          "signup_token": {
            "type": "string",
            "description": "Opaque token used to verify or resend the pending CLI signup"
          },
          "email": {
            "type": "string",
            "format": "email"
          },
          "expires_in": {
            "type": "integer",
            "description": "Seconds until the pending signup expires"
          },
          "resend_after": {
            "type": "integer",
            "description": "Minimum seconds before requesting another verification email"
          },
          "verification_code_length": {
            "type": "integer",
            "description": "Number of digits in the emailed verification code"
          }
        },
        "required": [
          "signup_token",
          "email",
          "expires_in",
          "resend_after",
          "verification_code_length"
        ]
      },
      "ResendCliSignupVerificationInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "signup_token": {
            "type": "string",
            "minLength": 1
          }
        },
        "required": [
          "signup_token"
        ]
      },
      "CliSignupResendResult": {
        "type": "object",
        "properties": {
          "email": {
            "type": "string",
            "format": "email"
          },
          "expires_in": {
            "type": "integer",
            "description": "Seconds until the pending signup expires"
          },
          "resend_after": {
            "type": "integer",
            "description": "Minimum seconds before requesting another verification email"
          },
          "verification_code_length": {
            "type": "integer",
            "description": "Number of digits in the emailed verification code"
          }
        },
        "required": [
          "email",
          "expires_in",
          "resend_after",
          "verification_code_length"
        ]
      },
      "VerifyCliSignupInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "signup_token": {
            "type": "string",
            "minLength": 1
          },
          "verification_code": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32
          },
          "password": {
            "type": "string",
            "minLength": 1,
            "maxLength": 1024
          }
        },
        "required": [
          "signup_token",
          "verification_code"
        ]
      },
      "CliSignupVerifyResult": {
        "type": "object",
        "properties": {
          "api_key": {
            "type": "string",
            "description": "Legacy alias for access_token. New CLI builds should persist access_token and refresh_token."
          },
          "key_id": {
            "type": "string",
            "format": "uuid",
            "description": "Legacy alias for oauth_grant_id"
          },
          "key_prefix": {
            "type": "string",
            "description": "Legacy display prefix derived from access_token"
          },
          "access_token": {
            "type": "string",
            "description": "OAuth access token for CLI API authentication"
          },
          "refresh_token": {
            "type": "string",
            "description": "OAuth refresh token used by the CLI to renew access"
          },
          "token_type": {
            "type": "string",
            "enum": [
              "Bearer"
            ]
          },
          "expires_in": {
            "type": "integer",
            "description": "Seconds until access_token expires"
          },
          "auth_method": {
            "type": "string",
            "enum": [
              "oauth"
            ]
          },
          "oauth_grant_id": {
            "type": "string",
            "format": "uuid"
          },
          "oauth_client_id": {
            "type": "string"
          },
          "org_id": {
            "type": "string",
            "format": "uuid"
          },
          "org_name": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "api_key",
          "key_id",
          "key_prefix",
          "access_token",
          "refresh_token",
          "token_type",
          "expires_in",
          "auth_method",
          "oauth_grant_id",
          "oauth_client_id",
          "org_id",
          "org_name"
        ]
      },
      "StartAgentSignupInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "email": {
            "type": "string",
            "format": "email",
            "maxLength": 254
          },
          "signup_code": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          },
          "terms_accepted": {
            "type": "boolean",
            "const": true,
            "description": "Must be true to confirm acceptance of Primitive's Terms of Service and Privacy Policy"
          },
          "device_name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 80,
            "description": "Human-readable device name used for the created agent OAuth session"
          },
          "metadata": {
            "type": "object",
            "additionalProperties": true,
            "description": "Optional client metadata stored with the signup session; serialized JSON must be 2048 bytes or fewer"
          }
        },
        "required": [
          "email",
          "signup_code",
          "terms_accepted"
        ]
      },
      "AgentSignupStartResult": {
        "type": "object",
        "properties": {
          "signup_token": {
            "type": "string",
            "description": "Opaque token used to verify or resend the pending agent signup"
          },
          "email": {
            "type": "string",
            "format": "email"
          },
          "expires_in": {
            "type": "integer",
            "description": "Seconds until the pending signup expires"
          },
          "resend_after": {
            "type": "integer",
            "description": "Minimum seconds before requesting another verification email"
          },
          "verification_code_length": {
            "type": "integer",
            "description": "Number of digits in the emailed verification code"
          }
        },
        "required": [
          "signup_token",
          "email",
          "expires_in",
          "resend_after",
          "verification_code_length"
        ]
      },
      "ResendAgentSignupVerificationInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "signup_token": {
            "type": "string",
            "minLength": 1
          }
        },
        "required": [
          "signup_token"
        ]
      },
      "AgentSignupResendResult": {
        "type": "object",
        "properties": {
          "email": {
            "type": "string",
            "format": "email"
          },
          "expires_in": {
            "type": "integer",
            "description": "Seconds until the pending signup expires"
          },
          "resend_after": {
            "type": "integer",
            "description": "Minimum seconds before requesting another verification email"
          },
          "verification_code_length": {
            "type": "integer",
            "description": "Number of digits in the emailed verification code"
          }
        },
        "required": [
          "email",
          "expires_in",
          "resend_after",
          "verification_code_length"
        ]
      },
      "VerifyAgentSignupInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "signup_token": {
            "type": "string",
            "minLength": 1
          },
          "verification_code": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32
          },
          "org_id": {
            "type": "string",
            "format": "uuid",
            "description": "Optional workspace id to target when the verified email already belongs to multiple workspaces"
          }
        },
        "required": [
          "signup_token",
          "verification_code"
        ]
      },
      "AgentOrgRef": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "name": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "id",
          "name"
        ]
      },
      "AgentSignupVerifyResult": {
        "type": "object",
        "properties": {
          "api_key": {
            "type": "string",
            "description": "Legacy alias for access_token. New CLI builds should persist access_token and refresh_token."
          },
          "key_id": {
            "type": "string",
            "format": "uuid",
            "description": "Legacy alias for oauth_grant_id"
          },
          "key_prefix": {
            "type": "string",
            "description": "Legacy display prefix derived from access_token"
          },
          "access_token": {
            "type": "string",
            "description": "OAuth access token for CLI API authentication"
          },
          "refresh_token": {
            "type": "string",
            "description": "OAuth refresh token used by the CLI to renew access"
          },
          "token_type": {
            "type": "string",
            "enum": [
              "Bearer"
            ]
          },
          "expires_in": {
            "type": "integer",
            "description": "Seconds until access_token expires"
          },
          "auth_method": {
            "type": "string",
            "enum": [
              "oauth"
            ]
          },
          "oauth_grant_id": {
            "type": "string",
            "format": "uuid"
          },
          "oauth_client_id": {
            "type": "string"
          },
          "org_id": {
            "type": "string",
            "format": "uuid"
          },
          "org_name": {
            "type": [
              "string",
              "null"
            ]
          },
          "orgs": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/AgentOrgRef"
            },
            "description": "Workspaces available to the verified email. The minted session targets `org_id`."
          }
        },
        "required": [
          "api_key",
          "key_id",
          "key_prefix",
          "access_token",
          "refresh_token",
          "token_type",
          "expires_in",
          "auth_method",
          "oauth_grant_id",
          "oauth_client_id",
          "org_id",
          "org_name",
          "orgs"
        ]
      },
      "CliLogoutInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "key_id": {
            "type": "string",
            "format": "uuid",
            "description": "Optional id guard; when provided it must match the authenticated OAuth grant id or API key id"
          }
        }
      },
      "CliLogoutResult": {
        "type": "object",
        "properties": {
          "revoked": {
            "type": "boolean",
            "description": "True when an OAuth grant was revoked. False for API-key-authenticated legacy logout, which only clears local CLI state."
          },
          "key_id": {
            "type": "string",
            "format": "uuid",
            "description": "API key id for API-key-authenticated legacy logout"
          },
          "oauth_grant_id": {
            "type": "string",
            "format": "uuid",
            "description": "OAuth grant id revoked by OAuth-authenticated logout"
          }
        },
        "required": [
          "revoked"
        ]
      },
      "Account": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "email": {
            "type": "string"
          },
          "plan": {
            "type": "string"
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          },
          "onboarding_completed": {
            "type": "boolean"
          },
          "onboarding_step": {
            "type": [
              "string",
              "null"
            ]
          },
          "stripe_subscription_status": {
            "type": [
              "string",
              "null"
            ]
          },
          "subscription_current_period_end": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "subscription_cancel_at_period_end": {
            "type": [
              "boolean",
              "null"
            ]
          },
          "spam_threshold": {
            "type": [
              "number",
              "null"
            ],
            "minimum": 0,
            "maximum": 15
          },
          "discard_content_on_webhook_confirmed": {
            "type": "boolean"
          },
          "webhook_secret_rotated_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          }
        },
        "required": [
          "id",
          "email",
          "plan",
          "created_at",
          "discard_content_on_webhook_confirmed"
        ]
      },
      "AccountUpdated": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "email": {
            "type": "string"
          },
          "plan": {
            "type": "string"
          },
          "spam_threshold": {
            "type": [
              "number",
              "null"
            ],
            "minimum": 0,
            "maximum": 15
          },
          "discard_content_on_webhook_confirmed": {
            "type": "boolean"
          }
        },
        "required": [
          "id",
          "email",
          "plan",
          "discard_content_on_webhook_confirmed"
        ]
      },
      "UpdateAccountInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "spam_threshold": {
            "type": [
              "number",
              "null"
            ],
            "minimum": 0,
            "maximum": 15,
            "description": "Global spam score threshold (0-15). Emails scoring above this are rejected. Set to null to disable."
          },
          "discard_content_on_webhook_confirmed": {
            "type": "boolean",
            "description": "Whether to discard email content after the webhook endpoint confirms receipt."
          }
        },
        "minProperties": 1
      },
      "StorageStats": {
        "type": "object",
        "properties": {
          "used_bytes": {
            "type": "integer",
            "description": "Total storage used in bytes"
          },
          "used_kb": {
            "type": "number",
            "description": "Total storage used in kilobytes (1 decimal)"
          },
          "used_mb": {
            "type": "number",
            "description": "Total storage used in megabytes (2 decimals)"
          },
          "quota_mb": {
            "type": "number",
            "description": "Storage quota in megabytes (based on plan)"
          },
          "percentage": {
            "type": "number",
            "description": "Percentage of quota used (1 decimal)"
          },
          "emails_count": {
            "type": "integer",
            "description": "Number of stored emails"
          }
        },
        "required": [
          "used_bytes",
          "used_kb",
          "used_mb",
          "quota_mb",
          "percentage",
          "emails_count"
        ]
      },
      "WebhookSecret": {
        "type": "object",
        "properties": {
          "secret": {
            "type": "string",
            "description": "The webhook signing secret value"
          }
        },
        "required": [
          "secret"
        ]
      },
      "InboxStatus": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "ready": {
            "type": "boolean",
            "description": "True when at least one active inbound domain has an enabled processing route."
          },
          "receiving_ready": {
            "type": "boolean",
            "description": "True when at least one active verified or managed domain can receive mail."
          },
          "processing_ready": {
            "type": "boolean",
            "description": "True when at least one receiving-ready domain has an enabled webhook or function route."
          },
          "summary": {
            "type": "string",
            "description": "Short human-readable status summary."
          },
          "next_actions": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/InboxStatusNextAction"
            }
          },
          "domains": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/InboxStatusDomain"
            }
          },
          "endpoints": {
            "$ref": "#/components/schemas/InboxStatusEndpointSummary"
          },
          "functions": {
            "$ref": "#/components/schemas/InboxStatusFunctionSummary"
          },
          "recent_emails": {
            "$ref": "#/components/schemas/InboxStatusRecentEmailSummary"
          }
        },
        "required": [
          "ready",
          "receiving_ready",
          "processing_ready",
          "summary",
          "next_actions",
          "domains",
          "endpoints",
          "functions",
          "recent_emails"
        ]
      },
      "InboxStatusNextAction": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "kind": {
            "type": "string",
            "enum": [
              "add_domain",
              "verify_domain",
              "configure_processing",
              "send_test_email",
              "fix_failed_functions"
            ]
          },
          "message": {
            "type": "string",
            "description": "Human-readable next step."
          },
          "command": {
            "type": "string",
            "description": "Suggested Primitive CLI command when there is an obvious next step."
          }
        },
        "required": [
          "kind",
          "message"
        ]
      },
      "InboxStatusDomain": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "id": {
            "type": "string"
          },
          "domain": {
            "type": "string"
          },
          "verified": {
            "type": "boolean"
          },
          "active": {
            "type": "boolean"
          },
          "managed": {
            "type": "boolean"
          },
          "receiving_ready": {
            "type": "boolean"
          },
          "processing_ready": {
            "type": "boolean"
          },
          "processing_route_count": {
            "type": "integer"
          },
          "endpoint_count": {
            "type": "integer"
          },
          "enabled_endpoint_count": {
            "type": "integer"
          },
          "function_endpoint_count": {
            "type": "integer"
          },
          "email_count": {
            "type": "integer",
            "description": "Number of inbound emails received for this domain in the last 30 days."
          },
          "latest_email_received_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time",
            "description": "Most recent inbound email received for this domain in the last 30 days."
          },
          "status": {
            "type": "string",
            "enum": [
              "ready",
              "stored_only",
              "pending_dns",
              "inactive"
            ]
          }
        },
        "required": [
          "id",
          "domain",
          "verified",
          "active",
          "managed",
          "receiving_ready",
          "processing_ready",
          "processing_route_count",
          "endpoint_count",
          "enabled_endpoint_count",
          "function_endpoint_count",
          "email_count",
          "latest_email_received_at",
          "status"
        ]
      },
      "InboxStatusEndpointSummary": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "total": {
            "type": "integer"
          },
          "enabled": {
            "type": "integer"
          },
          "disabled": {
            "type": "integer"
          },
          "fallback_enabled": {
            "type": "integer"
          },
          "domain_scoped_enabled": {
            "type": "integer"
          },
          "http_enabled": {
            "type": "integer"
          },
          "function_enabled": {
            "type": "integer"
          }
        },
        "required": [
          "total",
          "enabled",
          "disabled",
          "fallback_enabled",
          "domain_scoped_enabled",
          "http_enabled",
          "function_enabled"
        ]
      },
      "InboxStatusFunctionSummary": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "total": {
            "type": "integer"
          },
          "deployed": {
            "type": "integer"
          },
          "pending": {
            "type": "integer"
          },
          "failed": {
            "type": "integer"
          }
        },
        "required": [
          "total",
          "deployed",
          "pending",
          "failed"
        ]
      },
      "InboxStatusRecentEmailSummary": {
        "type": "object",
        "description": "Inbound email activity from the last 30 days.",
        "additionalProperties": false,
        "properties": {
          "total": {
            "type": "integer",
            "description": "Number of inbound emails received in the last 30 days."
          },
          "latest_received_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time",
            "description": "Most recent inbound email received in the last 30 days."
          }
        },
        "required": [
          "total",
          "latest_received_at"
        ]
      },
      "Domain": {
        "description": "A domain can be either verified or unverified. Verified domains have\n`is_active` and `spam_threshold` fields. Unverified domains have a\n`verification_token` and `dns_records` for DNS setup.\n",
        "oneOf": [
          {
            "$ref": "#/components/schemas/VerifiedDomain"
          },
          {
            "$ref": "#/components/schemas/UnverifiedDomain"
          }
        ]
      },
      "VerifiedDomain": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "org_id": {
            "type": "string",
            "format": "uuid"
          },
          "domain": {
            "type": "string"
          },
          "verified": {
            "type": "boolean",
            "const": true
          },
          "is_active": {
            "type": "boolean"
          },
          "spam_threshold": {
            "type": [
              "number",
              "null"
            ],
            "minimum": 0,
            "maximum": 15
          },
          "verification_token": {
            "type": [
              "string",
              "null"
            ]
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "id",
          "org_id",
          "domain",
          "verified",
          "is_active",
          "created_at"
        ]
      },
      "DomainDnsRecord": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "type": {
            "type": "string",
            "enum": [
              "MX",
              "TXT"
            ],
            "description": "DNS record type."
          },
          "name": {
            "type": "string",
            "description": "DNS-provider host/name value relative to the managed root zone."
          },
          "fqdn": {
            "type": "string",
            "description": "Fully-qualified DNS record name."
          },
          "value": {
            "type": "string",
            "description": "Exact value to publish."
          },
          "priority": {
            "type": "integer",
            "description": "MX priority. Present only for MX records."
          },
          "ttl": {
            "type": "integer",
            "description": "Suggested TTL in seconds when the API can provide one."
          },
          "required": {
            "type": "boolean",
            "const": true
          },
          "purpose": {
            "type": "string",
            "enum": [
              "inbound_mx",
              "ownership_verification",
              "spf",
              "dkim",
              "dmarc",
              "tls_reporting"
            ]
          },
          "status": {
            "type": "string",
            "enum": [
              "pending",
              "found",
              "missing",
              "incorrect"
            ]
          },
          "message": {
            "type": "string",
            "description": "Short explanation of why this record is needed."
          }
        },
        "required": [
          "type",
          "name",
          "fqdn",
          "value",
          "required",
          "purpose",
          "status"
        ]
      },
      "UnverifiedDomain": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "org_id": {
            "type": "string",
            "format": "uuid"
          },
          "domain": {
            "type": "string"
          },
          "verified": {
            "type": "boolean",
            "const": false
          },
          "verification_token": {
            "type": "string",
            "description": "Add this value as a TXT record to verify ownership"
          },
          "dns_records": {
            "type": "array",
            "description": "Exact DNS records to publish for this pending domain claim.",
            "items": {
              "$ref": "#/components/schemas/DomainDnsRecord"
            }
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "id",
          "org_id",
          "domain",
          "verified",
          "verification_token",
          "created_at"
        ]
      },
      "AddDomainInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "domain": {
            "type": "string",
            "minLength": 1,
            "maxLength": 253,
            "description": "The domain name to claim (e.g. \"example.com\")"
          },
          "confirmed": {
            "type": "boolean",
            "description": "Set to true to confirm replacing an existing mailbox provider after an mx_conflict response."
          },
          "outbound": {
            "type": "boolean",
            "deprecated": true,
            "description": "Deprecated and ignored. Outbound DNS is provisioned for every new domain claim."
          }
        },
        "required": [
          "domain"
        ]
      },
      "UpdateDomainInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "is_active": {
            "type": "boolean",
            "description": "Whether the domain accepts incoming emails"
          },
          "spam_threshold": {
            "type": [
              "number",
              "null"
            ],
            "minimum": 0,
            "maximum": 15,
            "description": "Per-domain spam threshold override (Pro plan required)"
          }
        },
        "minProperties": 1
      },
      "DomainVerifyResult": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "verified": {
                "type": "boolean",
                "const": true
              },
              "dns_records": {
                "type": "array",
                "description": "Exact DNS records checked for this verification attempt.",
                "items": {
                  "$ref": "#/components/schemas/DomainDnsRecord"
                }
              }
            },
            "required": [
              "verified"
            ]
          },
          {
            "type": "object",
            "properties": {
              "verified": {
                "type": "boolean",
                "const": false
              },
              "mxFound": {
                "type": "boolean",
                "description": "Whether MX records point to Primitive"
              },
              "txtFound": {
                "type": "boolean",
                "description": "Whether the TXT verification record was found"
              },
              "spfFound": {
                "type": "boolean",
                "description": "Whether the SPF record includes Primitive."
              },
              "dkimFound": {
                "type": "boolean",
                "description": "Whether the DKIM public key record was found."
              },
              "dmarcFound": {
                "type": "boolean",
                "description": "Whether the DMARC record was found."
              },
              "tlsRptFound": {
                "type": "boolean",
                "description": "Whether the TLS-RPT record was found."
              },
              "dns_records": {
                "type": "array",
                "description": "Exact DNS records checked for this verification attempt.",
                "items": {
                  "$ref": "#/components/schemas/DomainDnsRecord"
                }
              },
              "error": {
                "type": "string",
                "description": "Human-readable verification failure reason"
              }
            },
            "required": [
              "verified",
              "mxFound",
              "txtFound",
              "error"
            ]
          }
        ]
      },
      "EmailSummary": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "message_id": {
            "type": [
              "string",
              "null"
            ]
          },
          "domain_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid"
          },
          "org_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid"
          },
          "status": {
            "$ref": "#/components/schemas/EmailStatus"
          },
          "sender": {
            "type": "string",
            "description": "SMTP envelope sender (return-path) the inbound mail server\naccepted. For most legitimate mail this equals the bare\naddress in the From header; for mailing lists, bounce\nhandlers, and forwarders it is typically the bounce address\nrather than the human-visible sender.\n\nFor the parsed From-header value (with display name handling\nand a sender-fallback when the header is unparseable), GET\nthe email by id and use `from_email`.\n"
          },
          "recipient": {
            "type": "string"
          },
          "subject": {
            "type": [
              "string",
              "null"
            ]
          },
          "domain": {
            "type": "string"
          },
          "spam_score": {
            "type": [
              "number",
              "null"
            ]
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          },
          "received_at": {
            "type": "string",
            "format": "date-time"
          },
          "raw_size_bytes": {
            "type": [
              "integer",
              "null"
            ]
          },
          "webhook_status": {
            "$ref": "#/components/schemas/EmailWebhookStatus"
          },
          "webhook_attempt_count": {
            "type": "integer"
          },
          "thread_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid",
            "description": "Conversation thread this message belongs to. Fetch\n`/threads/{thread_id}` for the full ordered thread. NULL on\nmessages received before threading was enabled.\n"
          }
        },
        "required": [
          "id",
          "status",
          "sender",
          "recipient",
          "domain",
          "created_at",
          "received_at",
          "webhook_attempt_count"
        ]
      },
      "EmailSearchHighlights": {
        "type": "object",
        "properties": {
          "subject": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Subject snippets with matching terms highlighted."
          },
          "body": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Body snippets with matching terms highlighted."
          }
        },
        "required": [
          "subject",
          "body"
        ]
      },
      "EmailSearchResult": {
        "allOf": [
          {
            "$ref": "#/components/schemas/EmailSummary"
          },
          {
            "type": "object",
            "properties": {
              "attachment_count": {
                "type": "integer",
                "description": "Number of parsed attachments on the email."
              },
              "from_known_address": {
                "type": "boolean",
                "description": "Whether the parsed From address is known to this org from prior authenticated inbound mail."
              },
              "score": {
                "type": "number",
                "description": "Relevance score. Present only when sorting by relevance."
              },
              "highlights": {
                "$ref": "#/components/schemas/EmailSearchHighlights"
              }
            },
            "required": [
              "attachment_count",
              "from_known_address"
            ]
          }
        ]
      },
      "EmailSearchMeta": {
        "type": "object",
        "properties": {
          "total": {
            "type": "integer",
            "description": "Total number of matching records, capped when `total_capped` is true."
          },
          "total_capped": {
            "type": "boolean",
            "description": "Whether `total` was capped instead of counted exactly."
          },
          "limit": {
            "type": "integer",
            "description": "Page size used for this request."
          },
          "cursor": {
            "type": [
              "string",
              "null"
            ],
            "description": "Cursor for the next search page, or null if no more results."
          },
          "sort": {
            "type": "string",
            "enum": [
              "relevance",
              "received_at_desc",
              "received_at_asc"
            ],
            "description": "Sort mode used for the result page."
          }
        },
        "required": [
          "total",
          "total_capped",
          "limit",
          "cursor",
          "sort"
        ]
      },
      "EmailSearchFacetBucket": {
        "type": "object",
        "properties": {
          "value": {
            "type": [
              "string",
              "null"
            ]
          },
          "count": {
            "type": "integer"
          }
        },
        "required": [
          "value",
          "count"
        ]
      },
      "EmailSearchFacets": {
        "type": "object",
        "properties": {
          "by_sender": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/EmailSearchFacetBucket"
            }
          },
          "by_domain": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/EmailSearchFacetBucket"
            }
          },
          "by_status": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/EmailSearchFacetBucket"
            }
          },
          "has_attachment": {
            "type": "object",
            "properties": {
              "true": {
                "type": "integer"
              },
              "false": {
                "type": "integer"
              }
            },
            "required": [
              "true",
              "false"
            ]
          }
        },
        "required": [
          "by_sender",
          "by_domain",
          "by_status",
          "has_attachment"
        ]
      },
      "EmailDetail": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "message_id": {
            "type": [
              "string",
              "null"
            ]
          },
          "domain_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid"
          },
          "org_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid"
          },
          "sender": {
            "type": "string",
            "description": "SMTP envelope sender (return-path) the inbound mail server\naccepted. Same value as `smtp_mail_from`; both fields exist\nso protocol-aware tooling can use whichever name it expects.\n\nFor most legitimate mail this equals `from_email`; for\nmailing lists, bounce handlers, and forwarders it is\ntypically the bounce-handling address rather than the\nhuman-visible sender.\n\n**For the canonical \"who sent this email\" value, use\n`from_email`.**\n"
          },
          "recipient": {
            "type": "string"
          },
          "subject": {
            "type": [
              "string",
              "null"
            ]
          },
          "body_text": {
            "type": [
              "string",
              "null"
            ],
            "description": "Plain-text body parsed from the inbound MIME, matching the `email.parsed.body_text` field on the webhook payload. Null when the message had no text part or parsing failed."
          },
          "body_html": {
            "type": [
              "string",
              "null"
            ],
            "description": "HTML body parsed from the inbound MIME, matching the `email.parsed.body_html` field on the webhook payload. Null when the message had no HTML part or parsing failed."
          },
          "status": {
            "$ref": "#/components/schemas/EmailStatus"
          },
          "domain": {
            "type": "string"
          },
          "spam_score": {
            "type": [
              "number",
              "null"
            ]
          },
          "raw_size_bytes": {
            "type": [
              "integer",
              "null"
            ]
          },
          "raw_sha256": {
            "type": [
              "string",
              "null"
            ]
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          },
          "received_at": {
            "type": "string",
            "format": "date-time"
          },
          "rejection_reason": {
            "type": [
              "string",
              "null"
            ]
          },
          "webhook_status": {
            "$ref": "#/components/schemas/EmailWebhookStatus"
          },
          "webhook_attempt_count": {
            "type": "integer"
          },
          "webhook_last_attempt_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "webhook_last_status_code": {
            "type": [
              "integer",
              "null"
            ]
          },
          "webhook_last_error": {
            "type": [
              "string",
              "null"
            ]
          },
          "webhook_fired_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "smtp_helo": {
            "type": [
              "string",
              "null"
            ]
          },
          "smtp_mail_from": {
            "type": [
              "string",
              "null"
            ],
            "description": "SMTP envelope MAIL FROM (return-path), as accepted by the\ninbound mail server. Same value as `sender`; both fields\nexist so protocol-aware tooling can use whichever name it\nexpects.\n\nFor the canonical \"who sent this email\" value (display name\nstripped, From-header preferred), use `from_email`.\n"
          },
          "smtp_rcpt_to": {
            "type": [
              "array",
              "null"
            ],
            "items": {
              "type": "string"
            }
          },
          "from_header": {
            "type": [
              "string",
              "null"
            ],
            "description": "Raw `From:` header from the message body, including any\ndisplay name (e.g. `\"Alice Example\" <alice@example.com>`).\nUse this when you need the display name for rendering.\n\nFor the bare email address (display name stripped), use\n`from_email`.\n"
          },
          "content_discarded_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "content_discarded_by_delivery_id": {
            "type": [
              "string",
              "null"
            ]
          },
          "from_email": {
            "type": "string",
            "description": "Bare email address parsed from the `From:` header, with\ndisplay name stripped (e.g. `alice@example.com`). Falls\nback to `sender` (the SMTP envelope MAIL FROM) when the\n`From:` header cannot be parsed.\n\n**This is the canonical \"who sent this email\" field for\nmost use cases**, including comparing against allowlists,\nrouting replies, or displaying the sender to a user. Use\n`from_header` when you specifically need the display name,\nor `sender`/`smtp_mail_from` when you need the SMTP\nenvelope value (e.g. to follow a bounce).\n"
          },
          "to_email": {
            "type": "string",
            "description": "Parsed to address (same as recipient)"
          },
          "from_known_address": {
            "type": "boolean",
            "description": "True when the inbound's sender address has a matching grant\nin the org's known-send-addresses list. Advisory: a true\nvalue does not by itself guarantee that a reply will be\naccepted by send-mail's gates; the per-send check at send\ntime remains authoritative.\n"
          },
          "replies": {
            "type": "array",
            "description": "Sent emails recorded as replies to this inbound, in send\norder (ascending). Populated when a customer's send-mail\nrequest carries an `in_reply_to` Message-ID that matches\nthis inbound's `message_id` in the same org. Includes\nattempts that were gate-denied, so the array reflects every\nrecorded reply attempt regardless of outcome.\n",
            "items": {
              "$ref": "#/components/schemas/EmailDetailReply"
            }
          },
          "reply_to_sent_email_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid",
            "description": "The `sent_emails.id` of the outbound this inbound was a\nreply to, when resolvable. Set at inbound ingest by\nmatching the parsed In-Reply-To (or References, as a\nfallback) against `sent_emails.message_id` in the same\norg. The mirror of `sent_emails.in_reply_to_email_id` for\nthe inbound side of a thread. NULL when the inbound is\nnot a threaded reply to one of your sends, when neither\nheader survived the path through intermediate MTAs, or on\ninbound received before this auto-link landed.\n"
          },
          "thread_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid",
            "description": "Conversation thread this message belongs to. Inbound and\noutbound messages in the same conversation share a\n`thread_id`; fetch `/threads/{thread_id}` for the full\nordered thread. Assigned at ingest. NULL on messages\nreceived before threading was enabled (until backfilled).\n"
          },
          "parsed": {
            "allOf": [
              {
                "$ref": "#/components/schemas/ParsedEmailData"
              }
            ],
            "description": "Parsed MIME content (addresses, threading headers,\nattachment metadata), matching the `email.parsed` object\non the webhook payload so one parser handles both the\nwebhook and this endpoint. The top-level `body_text` /\n`body_html` fields above are the same values as\n`parsed.body_text` / `parsed.body_html`, retained for\nbackward compatibility.\n"
          },
          "auth": {
            "allOf": [
              {
                "$ref": "#/components/schemas/EmailAuth"
              }
            ],
            "description": "SPF / DKIM / DMARC verdicts computed at ingest, matching\nthe `email.auth` object on the webhook payload. Use these\nto decide how much to trust a message before acting on\ninstructions it contains.\n"
          }
        },
        "required": [
          "id",
          "sender",
          "recipient",
          "status",
          "domain",
          "created_at",
          "received_at",
          "webhook_attempt_count",
          "from_email",
          "to_email",
          "replies",
          "parsed",
          "auth"
        ]
      },
      "EmailDetailReply": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid",
            "description": "Sent-email row id."
          },
          "status": {
            "$ref": "#/components/schemas/SentEmailStatus"
          },
          "to_address": {
            "type": "string",
            "description": "Recipient address as recorded on the sent_emails row."
          },
          "subject": {
            "type": [
              "string",
              "null"
            ]
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          },
          "queue_id": {
            "type": [
              "string",
              "null"
            ],
            "description": "Outbound relay queue identifier when available."
          }
        },
        "required": [
          "id",
          "status",
          "to_address",
          "created_at"
        ]
      },
      "EmailAddress": {
        "type": "object",
        "description": "A parsed RFC 5322 address with optional display name.",
        "properties": {
          "name": {
            "type": [
              "string",
              "null"
            ],
            "description": "Display name, when present (e.g. `Alice Example`)."
          },
          "address": {
            "type": "string",
            "description": "Bare email address (e.g. `alice@example.com`)."
          }
        },
        "required": [
          "address"
        ]
      },
      "EmailAttachment": {
        "type": "object",
        "description": "Metadata for one attachment. The bytes are not inline; download\nall attachments for a message as a gzipped tarball via\n`/emails/{id}/attachments.tar.gz`. `sha256` lets you verify a\nspecific part after extraction.\n",
        "properties": {
          "filename": {
            "type": [
              "string",
              "null"
            ]
          },
          "content_type": {
            "type": [
              "string",
              "null"
            ]
          },
          "size_bytes": {
            "type": "integer"
          },
          "sha256": {
            "type": [
              "string",
              "null"
            ]
          },
          "part_index": {
            "type": "integer",
            "description": "Zero-based index of this part within the message."
          }
        },
        "required": [
          "size_bytes"
        ]
      },
      "ParsedEmailData": {
        "type": "object",
        "description": "Parsed MIME content for an inbound email. Mirrors the\n`email.parsed` object on the webhook payload so a single parser\nhandles both surfaces. `status` is `complete` when parsing\nsucceeded; on `failed` the body/address/attachment fields are\nabsent and `error` describes why.\n",
        "properties": {
          "status": {
            "type": "string",
            "enum": [
              "complete",
              "failed"
            ]
          },
          "body_text": {
            "type": [
              "string",
              "null"
            ],
            "description": "Plain-text body. Present when `status` is `complete`."
          },
          "body_html": {
            "type": [
              "string",
              "null"
            ],
            "description": "HTML body. Present when `status` is `complete`."
          },
          "reply_to": {
            "type": [
              "array",
              "null"
            ],
            "items": {
              "$ref": "#/components/schemas/EmailAddress"
            },
            "description": "Parsed `Reply-To` header addresses."
          },
          "cc": {
            "type": [
              "array",
              "null"
            ],
            "items": {
              "$ref": "#/components/schemas/EmailAddress"
            },
            "description": "Parsed `Cc` header addresses."
          },
          "bcc": {
            "type": [
              "array",
              "null"
            ],
            "items": {
              "$ref": "#/components/schemas/EmailAddress"
            },
            "description": "Parsed `Bcc` header addresses (rarely present on inbound)."
          },
          "to_addresses": {
            "type": [
              "array",
              "null"
            ],
            "items": {
              "$ref": "#/components/schemas/EmailAddress"
            },
            "description": "Parsed `To` header addresses."
          },
          "in_reply_to": {
            "type": [
              "array",
              "null"
            ],
            "items": {
              "type": "string"
            },
            "description": "Message-IDs from the `In-Reply-To` header."
          },
          "references": {
            "type": [
              "array",
              "null"
            ],
            "items": {
              "type": "string"
            },
            "description": "Message-IDs from the `References` header."
          },
          "attachments": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/EmailAttachment"
            },
            "description": "Attachment metadata. Empty array when none."
          },
          "error": {
            "type": [
              "object",
              "null"
            ],
            "description": "Present (non-null) only when `status` is `failed`. When\npresent, all three fields are populated, so a consumer can\nbranch on `code` without defensive null checks.\n",
            "properties": {
              "code": {
                "type": "string",
                "description": "Stable failure code (e.g. `PARSE_FAILED`)."
              },
              "message": {
                "type": "string"
              },
              "retryable": {
                "type": "boolean"
              }
            },
            "required": [
              "code",
              "message",
              "retryable"
            ]
          }
        },
        "required": [
          "status"
        ]
      },
      "DkimSignature": {
        "type": "object",
        "description": "One DKIM signature found on the message, with its verdict.",
        "properties": {
          "domain": {
            "type": "string"
          },
          "selector": {
            "type": "string"
          },
          "result": {
            "type": "string",
            "description": "Verification result (e.g. `pass`, `fail`, `none`)."
          },
          "aligned": {
            "type": "boolean",
            "description": "Whether the signing domain aligns with the From domain (for DMARC)."
          },
          "keyBits": {
            "type": [
              "integer",
              "null"
            ]
          },
          "algo": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "domain",
          "selector",
          "result",
          "aligned"
        ]
      },
      "EmailAuth": {
        "type": "object",
        "description": "SPF / DKIM / DMARC verdicts computed at ingest. Mirrors the\n`email.auth` object on the webhook payload. Field names are\ncamelCase to match that payload exactly. For messages received\nbefore auth was recorded, the verdicts default to `none`.\n",
        "properties": {
          "spf": {
            "type": "string",
            "description": "SPF result (e.g. `pass`, `fail`, `softfail`, `none`)."
          },
          "dmarc": {
            "type": "string",
            "description": "DMARC result (e.g. `pass`, `fail`, `none`)."
          },
          "dmarcPolicy": {
            "type": [
              "string",
              "null"
            ],
            "description": "Published DMARC policy (`none`, `quarantine`, `reject`)."
          },
          "dmarcFromDomain": {
            "type": [
              "string",
              "null"
            ],
            "description": "The From-header domain DMARC was evaluated against."
          },
          "dmarcSpfAligned": {
            "type": "boolean"
          },
          "dmarcDkimAligned": {
            "type": "boolean"
          },
          "dmarcSpfStrict": {
            "type": [
              "boolean",
              "null"
            ]
          },
          "dmarcDkimStrict": {
            "type": [
              "boolean",
              "null"
            ]
          },
          "dkimSignatures": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/DkimSignature"
            }
          }
        },
        "required": [
          "spf",
          "dmarc",
          "dmarcSpfAligned",
          "dmarcDkimAligned",
          "dkimSignatures"
        ]
      },
      "Thread": {
        "type": "object",
        "description": "A conversation thread: its metadata plus the inbound and\noutbound messages that belong to it, interleaved oldest-first.\nMembership is the stored `thread_id` on each message. Bodies are\nomitted here to keep the thread view lightweight; fetch\n`/emails/{id}` or `/sent-emails/{id}` for a single message's\nfull content.\n",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "subject": {
            "type": [
              "string",
              "null"
            ],
            "description": "Normalized subject of the thread (Re/Fwd prefixes stripped)."
          },
          "root_message_id": {
            "type": [
              "string",
              "null"
            ],
            "description": "Message-ID of the conversation root, when known."
          },
          "message_count": {
            "type": "integer",
            "description": "Total messages in the thread. `messages` is capped (most\nrecent first, then re-sorted oldest-first), so\n`message_count > messages.length` signals truncation.\n"
          },
          "first_message_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "last_message_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          },
          "messages": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/ThreadMessage"
            }
          }
        },
        "required": [
          "id",
          "message_count",
          "created_at",
          "messages"
        ]
      },
      "ThreadMessage": {
        "type": "object",
        "description": "One message in a thread (inbound or outbound).",
        "properties": {
          "direction": {
            "type": "string",
            "enum": [
              "inbound",
              "outbound"
            ],
            "description": "`inbound` for a received email (`/emails/{id}`), `outbound`\nfor a send (`/sent-emails/{id}`). Use it with `id` to fetch\nfull content from the right endpoint.\n"
          },
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "message_id": {
            "type": [
              "string",
              "null"
            ]
          },
          "from": {
            "type": [
              "string",
              "null"
            ]
          },
          "to": {
            "type": [
              "string",
              "null"
            ]
          },
          "subject": {
            "type": [
              "string",
              "null"
            ]
          },
          "status": {
            "type": [
              "string",
              "null"
            ],
            "description": "Lifecycle status (an EmailStatus or SentEmailStatus value, per `direction`)."
          },
          "timestamp": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time",
            "description": "received_at for inbound, created_at for outbound."
          }
        },
        "required": [
          "direction",
          "id"
        ]
      },
      "Conversation": {
        "type": "object",
        "description": "The full conversation an inbound email belongs to, as ordered,\nready-to-prompt turns with bodies. Resolves the thread from the\nemail and returns every message oldest-first, so an agent that\nreceived an email can pass `messages` straight to a chat model in\none call.\n",
        "properties": {
          "thread_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid",
            "description": "The thread this email belongs to, or null when the email\nisn't threaded yet (the conversation is then just this one\nmessage).\n"
          },
          "subject": {
            "type": [
              "string",
              "null"
            ],
            "description": "Normalized thread subject (Re/Fwd prefixes stripped), or the\nemail's own subject when it isn't threaded.\n"
          },
          "message_count": {
            "type": "integer",
            "description": "Total messages in the thread. `messages` is capped, so\n`truncated` is true (and this can exceed `messages.length`)\nwhen older messages were omitted.\n"
          },
          "truncated": {
            "type": "boolean",
            "description": "True when `messages` omits part of the conversation because\nthe thread exceeds the per-call cap.\n"
          },
          "messages": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/ConversationMessage"
            }
          }
        },
        "required": [
          "thread_id",
          "message_count",
          "truncated",
          "messages"
        ]
      },
      "ConversationMessage": {
        "type": "object",
        "description": "One message in the conversation, with its body and a chat role.",
        "properties": {
          "role": {
            "type": "string",
            "enum": [
              "user",
              "assistant"
            ],
            "description": "Chat role derived from `direction`: `user` for inbound\n(received) messages, `assistant` for outbound (your own prior\nreplies). Lets `messages` be passed directly to a chat model.\n"
          },
          "direction": {
            "type": "string",
            "enum": [
              "inbound",
              "outbound"
            ],
            "description": "`inbound` for a received email (`/emails/{id}`), `outbound`\nfor a send (`/sent-emails/{id}`).\n"
          },
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "message_id": {
            "type": [
              "string",
              "null"
            ]
          },
          "from": {
            "type": [
              "string",
              "null"
            ]
          },
          "to": {
            "type": [
              "string",
              "null"
            ]
          },
          "subject": {
            "type": [
              "string",
              "null"
            ]
          },
          "text": {
            "type": "string",
            "description": "Plain-text body. Empty string when the message has no text\npart or its content was discarded by retention.\n"
          },
          "timestamp": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time",
            "description": "received_at for inbound, created_at for outbound."
          }
        },
        "required": [
          "role",
          "direction",
          "id",
          "text"
        ]
      },
      "SendMailAttachment": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "filename": {
            "type": "string",
            "minLength": 1,
            "maxLength": 255,
            "description": "Attachment filename. Control characters are rejected."
          },
          "content_type": {
            "type": "string",
            "minLength": 1,
            "maxLength": 255,
            "description": "Optional MIME content type. Control characters are rejected."
          },
          "content_base64": {
            "type": "string",
            "minLength": 1,
            "maxLength": 44040192,
            "description": "Base64-encoded attachment bytes."
          }
        },
        "required": [
          "filename",
          "content_base64"
        ]
      },
      "SendMailInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "from": {
            "type": "string",
            "minLength": 3,
            "maxLength": 998,
            "description": "RFC 5322 From header. The sender domain must be a verified outbound domain for your organization."
          },
          "to": {
            "type": "string",
            "minLength": 3,
            "maxLength": 320,
            "description": "Recipient address. Recipient eligibility depends on your account's outbound entitlements."
          },
          "subject": {
            "type": "string",
            "minLength": 1,
            "maxLength": 998,
            "description": "Subject line for the outbound message"
          },
          "body_text": {
            "type": "string",
            "description": "Plain-text message body. At least one of body_text or body_html is required. The combined UTF-8 byte length of body_text and body_html must be at most 262144 bytes."
          },
          "body_html": {
            "type": "string",
            "description": "HTML message body. At least one of body_text or body_html is required. The combined UTF-8 byte length of body_text and body_html must be at most 262144 bytes."
          },
          "in_reply_to": {
            "type": "string",
            "minLength": 1,
            "maxLength": 998,
            "pattern": "^[^\\x00-\\x1F\\x7F]+$",
            "description": "Message-ID of the direct parent email when sending a threaded reply."
          },
          "references": {
            "type": "array",
            "maxItems": 100,
            "description": "Full ordered message-id chain for the thread.",
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 998,
              "pattern": "^[^\\x00-\\x1F\\x7F]+$"
            }
          },
          "attachments": {
            "type": "array",
            "maxItems": 100,
            "description": "Inline attachments. Send requests with attachments to https://api.primitive.dev/v1/send-mail. Combined raw decoded attachment bytes must be at most 31457280.",
            "items": {
              "$ref": "#/components/schemas/SendMailAttachment"
            }
          },
          "wait": {
            "type": "boolean",
            "description": "When true, wait for the first downstream SMTP delivery outcome before returning."
          },
          "wait_timeout_ms": {
            "type": "integer",
            "minimum": 1000,
            "maximum": 30000,
            "description": "Maximum time to wait for a delivery outcome when wait is true. Defaults to 30000."
          }
        },
        "required": [
          "from",
          "to",
          "subject"
        ]
      },
      "EmailStatus": {
        "type": "string",
        "description": "Lifecycle status of an INBOUND email (a row in the `emails`\ntable). Distinct from `SentEmailStatus`, which describes\nthe OUTBOUND lifecycle (the `sent_emails` table) and uses\na different vocabulary because the lifecycles differ.\nPossible values:\n\n  - `pending`: the row was inserted at ingestion (mx_main)\n    and has not yet completed the spam / filter / auth\n    pipeline. Body and parsed fields are present; webhook\n    delivery is not yet scheduled. Most rows transition out\n    of `pending` within seconds.\n  - `accepted`: the inbound passed the policy gates and is\n    queued for webhook delivery. The `webhook_status` field\n    tracks the separate webhook-delivery lifecycle from\n    this point.\n  - `completed`: terminal success. Webhook delivery\n    attempted and acknowledged by every active endpoint, OR\n    no endpoints are configured, so the row is durably\n    archived.\n  - `rejected`: terminal failure at ingestion (spam, blocked\n    sender, filter rule, malformed). The body and metadata\n    are stored for auditing but no webhook fires and the\n    row is not repliable.\n\nSee also `webhook_status` (separate enum tracking the\nwebhook-delivery state machine) and `SentEmailStatus` (the\noutbound vocabulary).\n",
        "enum": [
          "pending",
          "accepted",
          "completed",
          "rejected"
        ]
      },
      "EmailWebhookStatus": {
        "type": [
          "string",
          "null"
        ],
        "description": "Webhook-delivery state for an inbound email. Tracks a\nSEPARATE lifecycle from the email's `status` field; the\nsame row carries both. Possible values:\n\n  - `pending`: ingestion is past `pending` (the email itself\n    is `accepted`) but the webhook fan-out has not yet\n    started for this row.\n  - `in_flight`: at least one delivery attempt is in flight.\n  - `fired`: terminal success. Every active endpoint\n    acknowledged the delivery (or accepted it after retries).\n  - `failed`: terminal partial-failure. At least one endpoint\n    exhausted its retry budget; some endpoints may still\n    have succeeded.\n  - `exhausted`: terminal failure. Every endpoint exhausted\n    its retry budget without success.\n  - `null`: no endpoints configured, so no webhook lifecycle\n    applies.\n\nNote that the value `pending` here does NOT mean the email\nis `pending`; it means the email is past ingestion but\nwebhook delivery has not yet begun. Two overlapping uses\nof the word `pending` for distinct lifecycle phases.\n",
        "enum": [
          "pending",
          "in_flight",
          "fired",
          "failed",
          "exhausted",
          null
        ]
      },
      "SentEmailStatus": {
        "type": "string",
        "description": "Lifecycle status of a sent_emails row. Possible values:\n\n  - `queued`: pre-call INSERT; the outbound agent has not\n    yet replied.\n  - `submitted_to_agent`: agent accepted; `queue_id` is set.\n  - `agent_failed`: agent rejected; `error_code` and\n    `error_message` carry the reason.\n  - `gate_denied`: a recipient-scope gate denied the send;\n    the agent was never called. The `gates` array carries\n    the denial detail. /send-mail returns 403 in this case\n    so callers see the denial synchronously; /sent-emails\n    additionally records the row for historical lookup,\n    which is when this status appears in a listing.\n  - `unknown`: terminal indeterminate; the on-box log\n    poller couldn't classify the receiver's response.\n  - `delivered` / `bounced` / `deferred` / `wait_timeout`:\n    terminal delivery outcomes (see DeliveryStatus).\n",
        "enum": [
          "queued",
          "submitted_to_agent",
          "agent_failed",
          "gate_denied",
          "unknown",
          "delivered",
          "bounced",
          "deferred",
          "wait_timeout"
        ]
      },
      "DeliveryStatus": {
        "type": "string",
        "description": "Narrower enum covering only the four terminal delivery\noutcomes returned to a synchronous `wait: true` send.\n\nOn the SendMailResult shape, `delivery_status` is always\nequal to `status` whenever both are present (i.e. on\nterminal-state replays and live wait=true responses).\nThe two fields exist so callers that want to type-narrow\non \"this is a delivery outcome\" can pattern-match against\nthe four-value enum without handling the broader\nSentEmailStatus value set (which also covers `queued`,\n`submitted_to_agent`, `agent_failed`, `gate_denied`,\n`unknown`).\n\nOn async-mode and pre-terminal responses, `delivery_status`\nis absent and only `status` is populated. Use `status` if\nyou want a single field that's always present.\n",
        "enum": [
          "delivered",
          "bounced",
          "deferred",
          "wait_timeout"
        ]
      },
      "SentEmailSummary": {
        "type": "object",
        "description": "List-row projection of a sent-email record. Drops\n`body_text` and `body_html` to keep paginated responses\nsmall; fetch /sent-emails/{id} for the full record with\nbodies.\n",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "status": {
            "$ref": "#/components/schemas/SentEmailStatus"
          },
          "status_changed_at": {
            "type": "string",
            "format": "date-time",
            "description": "Timestamp of the most recent status transition.\nPolling clients should treat `status='queued'` AND\n`status_changed_at` older than 5 minutes as\n\"stuck-queued\" (the post-tx UPDATE failed and the\nactual delivery state is recoverable from on-box logs\nvia `queue_id` when populated, or `request_id`).\n"
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time"
          },
          "client_idempotency_key": {
            "type": [
              "string",
              "null"
            ],
            "description": "Effective idempotency key used for this send. If the\ncaller passed the `Idempotency-Key` header, this is\nthat value; otherwise it's a server-derived hash of\nthe canonical request payload.\n"
          },
          "content_hash": {
            "type": "string",
            "description": "Stable hash of the canonical send payload."
          },
          "from_header": {
            "type": "string",
            "description": "Raw `From:` header as sent on the wire, including any\ndisplay name (e.g. `\"Acme Support\" <agent@acme.test>`).\n"
          },
          "from_address": {
            "type": "string",
            "description": "Bare email address parsed from `from_header`."
          },
          "to_header": {
            "type": "string",
            "description": "Raw `To:` header as sent on the wire, including any\ndisplay name.\n"
          },
          "to_address": {
            "type": "string",
            "description": "Bare email address parsed from `to_header`."
          },
          "subject": {
            "type": "string"
          },
          "body_size_bytes": {
            "type": "integer",
            "description": "Total UTF-8 byte length of `body_text` + `body_html`.\nSurfaced on the list endpoint so callers can see \"this\nrow has a 4MB body\" without fetching it.\n"
          },
          "content_discarded_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time",
            "description": "Timestamp at which the bodies were discarded by an\nentitlement-driven retention policy. Null when bodies\nare still present. The detail endpoint returns\nnull-valued `body_text`/`body_html` for discarded rows.\n"
          },
          "message_id": {
            "type": [
              "string",
              "null"
            ],
            "description": "Wire-level Message-ID assigned to the outbound message\n(RFC 5322). Null on rows that never reached signing\n(queued, gate_denied, agent_failed before signing).\n"
          },
          "in_reply_to": {
            "type": [
              "string",
              "null"
            ],
            "description": "Wire-level In-Reply-To header value, when this send\nwas a reply.\n"
          },
          "email_references": {
            "type": [
              "string",
              "null"
            ],
            "description": "Wire-level References header value, when this send\nwas a reply.\n"
          },
          "in_reply_to_email_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid",
            "description": "Reference to the inbound `emails.id` that this send\nreplied to, when known. Populated when the caller used\n/emails/{id}/reply or when /send-mail's `in_reply_to`\nmatched a stored inbound message_id in the same org.\n"
          },
          "thread_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid",
            "description": "Conversation thread this send belongs to. A reply inherits\nthe thread of the inbound it answers; a fresh send starts a\nnew thread. Fetch `/threads/{thread_id}` for the full\nordered thread (inbound + outbound interleaved). NULL on\ngate-denied sends and on sends created before threading was\nenabled.\n"
          },
          "queue_id": {
            "type": [
              "string",
              "null"
            ],
            "description": "Message identifier assigned by Primitive's outbound\nrelay once the agent accepts the message. Null on\nqueued, gate_denied, and agent_failed rows.\n"
          },
          "smtp_response_code": {
            "type": [
              "integer",
              "null"
            ],
            "description": "Receiver's 3-digit SMTP code (e.g. 250, 550, 451).\nPopulated on terminal delivery statuses; may be null\non a deferred where the agent never got an SMTP-level\nresponse (TCP refused, DNS failed, TLS handshake\nfailed). `smtp_response_text` still carries Postfix's\ndescriptive text in those cases.\n"
          },
          "smtp_response_text": {
            "type": [
              "string",
              "null"
            ],
            "description": "Free-form text portion of the receiver's SMTP\nresponse. The most useful debugging signal on a\n`bounced` or `deferred` row.\n"
          },
          "smtp_enhanced_status_code": {
            "type": [
              "string",
              "null"
            ],
            "description": "RFC 3463 enhanced status code (e.g. `5.1.1` for \"Bad\ndestination mailbox address\"). Distinct from\n`smtp_response_code`: the basic 3-digit code is coarse\n(550 = \"permanent failure\"), the enhanced code is\nfiner-grained.\n"
          },
          "dkim_selector": {
            "type": [
              "string",
              "null"
            ],
            "description": "DKIM selector used to sign the outbound message.\nPublic DNS data; useful for diagnosing why a downstream\nverifier rejected the signature.\n"
          },
          "dkim_domain": {
            "type": [
              "string",
              "null"
            ],
            "description": "DKIM signing domain."
          },
          "error_code": {
            "type": [
              "string",
              "null"
            ],
            "description": "Stable public error code on `agent_failed` rows. The\nagent's internal codes are remapped to a stable public\ntaxonomy (see `publicAgentError` in the server) so this\nfield is safe to branch on across agent versions.\n"
          },
          "error_message": {
            "type": [
              "string",
              "null"
            ],
            "description": "Free-form error message accompanying `error_code`."
          },
          "gates": {
            "type": [
              "array",
              "null"
            ],
            "items": {
              "$ref": "#/components/schemas/GateDenial"
            },
            "description": "Gate-denial detail on `gate_denied` rows. Mirrors the\nsynchronous /send-mail 403 contract so a caller's\nGateDenial handler is the same across live denies and\nhistorical lookups. Null on every other status.\n"
          },
          "request_id": {
            "type": [
              "string",
              "null"
            ],
            "description": "Server-issued request identifier from the original\n/send-mail call. Surfaced as the `X-Request-Id`\nresponse header on the live send and recorded here\nfor support escalation.\n"
          }
        },
        "required": [
          "id",
          "status",
          "status_changed_at",
          "created_at",
          "updated_at",
          "content_hash",
          "from_header",
          "from_address",
          "to_header",
          "to_address",
          "subject",
          "body_size_bytes"
        ]
      },
      "SemanticSearchField": {
        "type": "string",
        "enum": [
          "subject",
          "headers",
          "addresses",
          "body"
        ],
        "description": "A searchable email field."
      },
      "SemanticSearchInput": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2048,
            "description": "Free-text query. Required for `semantic` and `hybrid` modes;\noptional for `keyword` mode.\n"
          },
          "mode": {
            "type": "string",
            "enum": [
              "hybrid",
              "semantic",
              "keyword"
            ],
            "default": "hybrid",
            "description": "Ranking strategy. `keyword` is lexical only, `semantic` is\nembedding-based, `hybrid` blends both.\n"
          },
          "corpus": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "inbound",
                "outbound"
              ]
            },
            "minItems": 1,
            "maxItems": 2,
            "description": "Which mail to search. Defaults to both received (`inbound`)\nand sent (`outbound`).\n"
          },
          "search_in": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/SemanticSearchField"
            },
            "description": "Restrict matching to these fields. Defaults to all."
          },
          "exclude": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/SemanticSearchField"
            },
            "description": "Exclude these fields from matching."
          },
          "date_from": {
            "type": "string",
            "format": "date-time",
            "description": "Only include mail at or after this timestamp."
          },
          "date_to": {
            "type": "string",
            "format": "date-time",
            "description": "Only include mail at or before this timestamp."
          },
          "include": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "coverage"
              ]
            },
            "description": "Opt-in extras. `coverage` adds an index-coverage snapshot to\n`meta`. Matched fields, snippets, and the score breakdown are\nalways returned regardless of this field.\n"
          },
          "limit": {
            "type": "integer",
            "minimum": 1,
            "maximum": 100,
            "default": 10,
            "description": "Maximum number of results to return."
          },
          "cursor": {
            "type": "string",
            "description": "Opaque pagination cursor from a prior response's `meta.cursor`."
          }
        }
      },
      "SemanticSearchSnippet": {
        "type": "object",
        "properties": {
          "field": {
            "type": "string",
            "description": "The field this excerpt came from."
          },
          "text": {
            "type": "string",
            "description": "Plain-text excerpt centered on the match (no markup)."
          }
        },
        "required": [
          "field",
          "text"
        ]
      },
      "SemanticSearchScoreBreakdown": {
        "type": "object",
        "description": "Additive contributions to `score`. `semantic` and `keyword` are the\nraw signals times the mode's weight (null when not applicable);\nthese plus `field_boost` and `recency` sum to `score` before each\nvalue is independently rounded to 5 decimal places.\n",
        "properties": {
          "semantic": {
            "type": [
              "number",
              "null"
            ]
          },
          "keyword": {
            "type": [
              "number",
              "null"
            ]
          },
          "field_boost": {
            "type": "number"
          },
          "recency": {
            "type": "number"
          }
        },
        "required": [
          "semantic",
          "keyword",
          "field_boost",
          "recency"
        ]
      },
      "SemanticSearchResult": {
        "type": "object",
        "properties": {
          "source_type": {
            "type": "string",
            "enum": [
              "inbound_email",
              "sent_email"
            ],
            "description": "Whether this row is a received or sent message."
          },
          "id": {
            "type": "string",
            "description": "Message id. Combine with `api_url` to fetch the full record."
          },
          "subject": {
            "type": [
              "string",
              "null"
            ]
          },
          "from": {
            "type": [
              "string",
              "null"
            ]
          },
          "to": {
            "type": [
              "string",
              "null"
            ]
          },
          "timestamp": {
            "type": "string",
            "description": "Message timestamp (received_at for inbound, created_at for sent)."
          },
          "status": {
            "type": "string",
            "description": "Lifecycle status of the message."
          },
          "score": {
            "type": "number",
            "description": "Overall relevance score; the `score_breakdown` components account for it."
          },
          "semantic_score": {
            "type": [
              "number",
              "null"
            ],
            "description": "Raw semantic similarity signal, or null when not applicable."
          },
          "keyword_score": {
            "type": [
              "number",
              "null"
            ],
            "description": "Raw keyword (lexical) signal, or null when not applicable."
          },
          "matched_fields": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/SemanticSearchField"
            },
            "description": "Fields where the query matched."
          },
          "snippets": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/SemanticSearchSnippet"
            },
            "description": "Match-centered excerpts, one per matched field."
          },
          "score_breakdown": {
            "$ref": "#/components/schemas/SemanticSearchScoreBreakdown"
          },
          "api_url": {
            "type": [
              "string",
              "null"
            ],
            "description": "Relative API path to fetch the full message."
          }
        },
        "required": [
          "source_type",
          "id",
          "subject",
          "from",
          "to",
          "timestamp",
          "status",
          "score",
          "semantic_score",
          "keyword_score",
          "matched_fields",
          "snippets",
          "score_breakdown",
          "api_url"
        ]
      },
      "SemanticSearchCoverage": {
        "type": "object",
        "description": "Index-coverage snapshot for the org, returned only when the `coverage` include option is requested.",
        "properties": {
          "embedded_chunks": {
            "type": "integer"
          },
          "pending_chunks": {
            "type": "integer"
          },
          "skipped_plan_chunks": {
            "type": "integer"
          },
          "skipped_quota_chunks": {
            "type": "integer"
          },
          "unsupported_attachment_chunks": {
            "type": "integer"
          },
          "failed_chunks": {
            "type": "integer"
          }
        },
        "required": [
          "embedded_chunks",
          "pending_chunks",
          "skipped_plan_chunks",
          "skipped_quota_chunks",
          "unsupported_attachment_chunks",
          "failed_chunks"
        ]
      },
      "SemanticSearchMeta": {
        "type": "object",
        "properties": {
          "limit": {
            "type": "integer",
            "description": "Page size used for this request."
          },
          "cursor": {
            "type": [
              "string",
              "null"
            ],
            "description": "Cursor for the next page, or null if there are no more results."
          },
          "mode": {
            "type": "string",
            "enum": [
              "hybrid",
              "semantic",
              "keyword"
            ],
            "description": "Ranking mode used for this response."
          },
          "coverage": {
            "oneOf": [
              {
                "$ref": "#/components/schemas/SemanticSearchCoverage"
              },
              {
                "type": "null"
              }
            ],
            "description": "Index-coverage snapshot, present only when requested via\n`include: [coverage]`; otherwise null.\n"
          }
        },
        "required": [
          "limit",
          "cursor",
          "mode",
          "coverage"
        ]
      },
      "SentEmailDetail": {
        "description": "Full sent-email record, including `body_text` and\n`body_html`. Returned by /sent-emails/{id}.\n",
        "allOf": [
          {
            "$ref": "#/components/schemas/SentEmailSummary"
          },
          {
            "type": "object",
            "properties": {
              "body_text": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Plain-text body sent on the wire. Null when the\nsend carried only an HTML body, or when bodies have\nbeen discarded post-send (`content_discarded_at`\nset).\n"
              },
              "body_html": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "HTML body sent on the wire. Null when the send\ncarried only a plain-text body, or when bodies\nhave been discarded post-send.\n"
              }
            }
          }
        ]
      },
      "ReplyInput": {
        "type": "object",
        "additionalProperties": false,
        "description": "Body shape for `/emails/{id}/reply`. Intentionally narrow:\nrecipients (`to`), subject, and threading headers\n(`in_reply_to`, `references`) are derived server-side from\nthe inbound row referenced by the path id and are rejected by\n`additionalProperties` if passed (returns 400).\n\n`from` IS allowed because of legitimate use cases (display-name\naddition, replying from a different verified outbound address,\nmulti-team triage). Send-mail's per-send `canSendFrom` gate\nvalidates the from-domain regardless, so the override carries\nno extra privilege.\n",
        "properties": {
          "body_text": {
            "type": "string",
            "description": "Plain-text reply body. At least one of body_text or body_html is required. The combined UTF-8 byte length of body_text and body_html must be at most 262144 bytes (same cap as send-mail)."
          },
          "body_html": {
            "type": "string",
            "description": "HTML reply body. At least one of body_text or body_html is required."
          },
          "from": {
            "type": "string",
            "minLength": 3,
            "maxLength": 998,
            "description": "Optional override for the reply's From header. Defaults to\nthe inbound's recipient. Use to add a display name (`\"Acme\nSupport\" <agent@company.com>`) or to reply from a different\nverified outbound address (e.g. multi-team routing where\nsupport@ triages to billing@). The from-domain must be a\nverified outbound domain for your org, same as send-mail.\n"
          },
          "wait": {
            "type": "boolean",
            "description": "When true, wait for the first downstream SMTP delivery outcome before returning, mirroring the send-mail `wait` semantics."
          },
          "attachments": {
            "type": "array",
            "maxItems": 100,
            "description": "Inline attachments for this reply. Use https://api.primitive.dev/v1 for replies with attachments. Combined raw decoded attachment bytes must be at most 31457280.",
            "items": {
              "$ref": "#/components/schemas/SendMailAttachment"
            }
          }
        }
      },
      "SendMailResult": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "Persisted sent-email attempt ID."
          },
          "status": {
            "$ref": "#/components/schemas/SentEmailStatus"
          },
          "from": {
            "type": "string",
            "description": "Bare from-address actually written on the wire. Echoed\non every success branch so callers can confirm what\nwent out, particularly useful for the /emails/{id}/reply\npath where `from` is server-derived from the inbound's\nrecipient when the caller doesn't override.\n\nFor sends where the caller passed a from-header that\nincluded a display name (e.g. `\"Acme Support\" <support@acme.test>`),\nthis field is the parsed bare address (`support@acme.test`).\nThe display name was sent on the wire intact; this field\njust makes the address easy to compare against allowlists.\n"
          },
          "queue_id": {
            "type": [
              "string",
              "null"
            ],
            "description": "Message identifier assigned by Primitive's OUTBOUND relay\n(the box that signs your mail and submits it to the\nreceiving MTA). NOT the receiver's queue id.\n\nThe receiver may also report its own queue id in\n`smtp_response_text` (e.g. `\"250 2.0.0 Ok: queued as\n99D111927CDA\"` from a Postfix receiver). Those two ids\nrefer to different mail systems and are NOT comparable.\nTreat `queue_id` as Primitive-internal and the\nreceiver's id as remote-system-internal.\n\nNull on rows that never reached the relay (queued,\ngate_denied, agent_failed before signing).\n"
          },
          "accepted": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Recipient addresses accepted by the relay."
          },
          "rejected": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Recipient addresses rejected by the relay."
          },
          "client_idempotency_key": {
            "type": "string",
            "description": "Effective idempotency key used for this send."
          },
          "request_id": {
            "type": "string",
            "description": "Server-issued request identifier for support and tracing."
          },
          "content_hash": {
            "type": "string",
            "description": "Stable hash of the canonical send payload."
          },
          "delivery_status": {
            "$ref": "#/components/schemas/DeliveryStatus"
          },
          "smtp_response_code": {
            "type": [
              "integer",
              "null"
            ],
            "description": "SMTP response code from the first downstream delivery outcome when wait is true."
          },
          "smtp_response_text": {
            "type": "string",
            "description": "SMTP response text from the first downstream delivery outcome when wait is true."
          },
          "idempotent_replay": {
            "type": "boolean",
            "description": "True when the response replays a previously-recorded send\nkeyed by `client_idempotency_key` (same key, same canonical\npayload). False on a fresh send and on gate-denied\nresponses. Lets callers branch on cache state without\ndiffing fields.\n"
          }
        },
        "required": [
          "id",
          "status",
          "from",
          "queue_id",
          "accepted",
          "rejected",
          "client_idempotency_key",
          "request_id",
          "content_hash",
          "idempotent_replay"
        ]
      },
      "SendPermissionRule": {
        "description": "One recipient-scope rule describing a destination the caller\nmay send to. Discriminated on `type`. Each rule carries a\nhuman-prose `description` field intended for display.\n\nRule kinds are stable within an SDK release. A response\ncontaining a `type` value not enumerated in this schema\nmeans the server is running a newer version than the SDK;\nupgrade the SDK to the release that matches the server's\nschema. Strict-parsing SDKs (Go, Python) will raise a\ndecode error in that case rather than silently dropping\nthe unknown rule, since silent drops would let an outbound\nagent reason from an incomplete view of its own permissions.\n",
        "discriminator": {
          "propertyName": "type",
          "mapping": {
            "any_recipient": "#/components/schemas/SendPermissionAnyRecipient",
            "managed_zone": "#/components/schemas/SendPermissionManagedZone",
            "your_domain": "#/components/schemas/SendPermissionYourDomain",
            "address": "#/components/schemas/SendPermissionAddress"
          }
        },
        "oneOf": [
          {
            "$ref": "#/components/schemas/SendPermissionAnyRecipient"
          },
          {
            "$ref": "#/components/schemas/SendPermissionManagedZone"
          },
          {
            "$ref": "#/components/schemas/SendPermissionYourDomain"
          },
          {
            "$ref": "#/components/schemas/SendPermissionAddress"
          }
        ]
      },
      "SendPermissionAnyRecipient": {
        "type": "object",
        "description": "The caller can send to any recipient. When this rule is\npresent, every other rule in the response is redundant.\n",
        "properties": {
          "type": {
            "type": "string",
            "enum": [
              "any_recipient"
            ]
          },
          "description": {
            "type": "string",
            "description": "Human-prose summary of the rule."
          }
        },
        "required": [
          "type",
          "description"
        ]
      },
      "SendPermissionManagedZone": {
        "type": "object",
        "description": "The caller can send to any address at the named\nPrimitive-managed zone. Always emitted (no entitlement\nrequired) because Primitive owns the zone and every mailbox\nbelongs to a Primitive customer by construction.\n",
        "properties": {
          "type": {
            "type": "string",
            "enum": [
              "managed_zone"
            ]
          },
          "zone": {
            "type": "string",
            "description": "The managed apex domain. Sends are accepted to any\naddress at the apex itself or any subdomain (e.g.\n`alice@primitive.email` and `alice@acme.primitive.email`\nboth match the `primitive.email` zone rule).\n"
          },
          "description": {
            "type": "string",
            "description": "Human-prose summary of the rule."
          }
        },
        "required": [
          "type",
          "zone",
          "description"
        ]
      },
      "SendPermissionYourDomain": {
        "type": "object",
        "description": "The caller can send to any address at one of their own\nverified outbound domains. Emitted once per active row in\nthe org's `domains` table.\n",
        "properties": {
          "type": {
            "type": "string",
            "enum": [
              "your_domain"
            ]
          },
          "domain": {
            "type": "string",
            "description": "A verified outbound domain owned by the caller's org."
          },
          "description": {
            "type": "string",
            "description": "Human-prose summary of the rule."
          }
        },
        "required": [
          "type",
          "domain",
          "description"
        ]
      },
      "SendPermissionAddress": {
        "type": "object",
        "description": "The caller can send to a specific address that has\nauthenticated inbound mail to the org. Emitted once per row\nin the org's `known_send_addresses` table, capped at\n`meta.address_cap`.\n",
        "properties": {
          "type": {
            "type": "string",
            "enum": [
              "address"
            ]
          },
          "address": {
            "type": "string",
            "description": "The bare email address this rule grants sends to."
          },
          "last_received_at": {
            "type": "string",
            "format": "date-time",
            "description": "Most recent inbound email from this address that\nauthenticated successfully (DMARC pass + DKIM/SPF\nalignment). Updated on each new authenticated receipt.\n"
          },
          "received_count": {
            "type": "integer",
            "description": "Total number of authenticated inbound emails from this\naddress. Increments only when `last_received_at` advances.\n"
          },
          "description": {
            "type": "string",
            "description": "Human-prose summary of the rule."
          }
        },
        "required": [
          "type",
          "address",
          "last_received_at",
          "received_count",
          "description"
        ]
      },
      "SendPermissionsMeta": {
        "type": "object",
        "description": "Response metadata for /send-permissions. The `address_cap`\nbounds the size of the `address` rule subset; orgs with more\nthan `address_cap` known addresses almost always also hold a\nbroader rule type (`any_recipient` or `your_domain`), so the\ncap is a response-size bound rather than a meaningful\nproduct limit.\n",
        "properties": {
          "address_cap": {
            "type": "integer",
            "description": "Maximum number of `address` rules included in `data`."
          },
          "truncated": {
            "type": "boolean",
            "description": "True when the org has more than `address_cap` known\naddresses and the list was truncated. False when every\nknown address is represented or when the org holds no\naddress rules at all.\n"
          }
        },
        "required": [
          "address_cap",
          "truncated"
        ]
      },
      "Endpoint": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "org_id": {
            "type": "string",
            "format": "uuid"
          },
          "url": {
            "type": [
              "string",
              "null"
            ]
          },
          "enabled": {
            "type": "boolean"
          },
          "domain_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid",
            "description": "Restrict this endpoint to emails from a specific domain"
          },
          "rules": {
            "type": "object",
            "description": "Endpoint-specific filtering rules"
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time"
          },
          "delivery_count": {
            "type": "integer",
            "description": "Total webhook deliveries attempted"
          },
          "success_count": {
            "type": "integer",
            "description": "Successful deliveries"
          },
          "failure_count": {
            "type": "integer",
            "description": "Failed deliveries"
          },
          "consecutive_fails": {
            "type": "integer",
            "description": "Current streak of consecutive failures"
          },
          "last_delivery_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "last_success_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "last_failure_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "deactivated_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          }
        },
        "required": [
          "id",
          "org_id",
          "enabled",
          "rules",
          "created_at",
          "updated_at",
          "delivery_count",
          "success_count",
          "failure_count",
          "consecutive_fails"
        ]
      },
      "CreateEndpointInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "url": {
            "type": "string",
            "minLength": 1,
            "description": "The webhook URL to deliver events to"
          },
          "enabled": {
            "type": "boolean",
            "default": true,
            "description": "Whether the endpoint is active"
          },
          "domain_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid",
            "description": "Restrict to emails from a specific domain"
          },
          "rules": {
            "type": "object",
            "description": "Endpoint-specific filtering rules"
          }
        },
        "required": [
          "url"
        ]
      },
      "UpdateEndpointInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "url": {
            "type": "string",
            "minLength": 1,
            "description": "New webhook URL (triggers endpoint rotation)"
          },
          "enabled": {
            "type": "boolean"
          },
          "domain_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid"
          },
          "rules": {
            "type": "object"
          }
        },
        "minProperties": 1
      },
      "TestResult": {
        "type": "object",
        "properties": {
          "status": {
            "type": "integer",
            "description": "HTTP status code returned by the endpoint"
          },
          "body": {
            "type": "string",
            "description": "Response body (truncated to 1000 characters)"
          },
          "signature": {
            "type": "string",
            "description": "The signature header value sent (if webhook secret is configured)"
          }
        },
        "required": [
          "status",
          "body"
        ]
      },
      "Filter": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "org_id": {
            "type": "string",
            "format": "uuid"
          },
          "domain_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid",
            "description": "If set, filter applies only to this domain"
          },
          "type": {
            "type": "string",
            "enum": [
              "whitelist",
              "blocklist"
            ]
          },
          "pattern": {
            "type": "string",
            "description": "Email address or pattern to match (stored lowercase)"
          },
          "enabled": {
            "type": "boolean"
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "id",
          "org_id",
          "type",
          "pattern",
          "enabled",
          "created_at"
        ]
      },
      "CreateFilterInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "type": {
            "type": "string",
            "enum": [
              "whitelist",
              "blocklist"
            ]
          },
          "pattern": {
            "type": "string",
            "minLength": 1,
            "maxLength": 500,
            "description": "Email address or pattern to filter"
          },
          "domain_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid",
            "description": "Restrict filter to a specific domain (Pro plan required)"
          }
        },
        "required": [
          "type",
          "pattern"
        ]
      },
      "UpdateFilterInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "enabled": {
            "type": "boolean"
          }
        },
        "required": [
          "enabled"
        ]
      },
      "DeliverySummary": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "Delivery ID (numeric string)"
          },
          "email_id": {
            "type": "string",
            "format": "uuid"
          },
          "org_id": {
            "type": "string",
            "format": "uuid"
          },
          "endpoint_id": {
            "type": "string",
            "format": "uuid"
          },
          "endpoint_url": {
            "type": "string"
          },
          "status": {
            "type": "string",
            "enum": [
              "pending",
              "delivered",
              "header_confirmed",
              "failed"
            ]
          },
          "attempt_count": {
            "type": "integer"
          },
          "duration_ms": {
            "type": [
              "integer",
              "null"
            ]
          },
          "last_error": {
            "type": [
              "string",
              "null"
            ]
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time"
          },
          "email": {
            "type": [
              "object",
              "null"
            ],
            "properties": {
              "sender": {
                "type": "string"
              },
              "recipient": {
                "type": "string"
              },
              "subject": {
                "type": [
                  "string",
                  "null"
                ]
              }
            },
            "required": [
              "sender",
              "recipient"
            ]
          }
        },
        "required": [
          "id",
          "email_id",
          "org_id",
          "endpoint_id",
          "endpoint_url",
          "status",
          "attempt_count",
          "created_at",
          "updated_at"
        ]
      },
      "ReplayResult": {
        "type": "object",
        "properties": {
          "delivered": {
            "type": "integer",
            "description": "Number of successful deliveries"
          },
          "failed": {
            "type": "integer",
            "description": "Number of failed deliveries"
          }
        },
        "required": [
          "delivered",
          "failed"
        ]
      },
      "DiscardContentResult": {
        "type": "object",
        "properties": {
          "discarded": {
            "type": "boolean",
            "description": "Always `true` on a 2xx response. The content is either now\ndiscarded as a result of this call, or was already discarded\nbefore this call ran.\n"
          },
          "already_discarded": {
            "type": "boolean",
            "description": "`true` if the email's content was already discarded before\nthis call ran (no work was done). `false` if this call was\nthe one that performed the discard.\n"
          }
        },
        "required": [
          "discarded",
          "already_discarded"
        ]
      },
      "FunctionDeployStatus": {
        "type": "string",
        "enum": [
          "pending",
          "deployed",
          "failed"
        ],
        "description": "Lifecycle state of the latest deploy attempt:\n  * `pending` — deploy in flight; the runtime has not yet\n    confirmed the new bundle is live.\n  * `deployed` — the running edge handler is the latest code.\n  * `failed` — the most recent deploy attempt failed; the\n    previously-live code (if any) is still running. The\n    `deploy_error` field carries the error message.\n"
      },
      "FunctionListItem": {
        "type": "object",
        "description": "One row from the function listing.",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid",
            "description": "Function id, also the script name in the edge runtime."
          },
          "name": {
            "type": "string",
            "description": "Slug-style name set on creation. Stable; cannot be changed."
          },
          "deploy_status": {
            "$ref": "#/components/schemas/FunctionDeployStatus"
          },
          "deployed_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time",
            "description": "Timestamp of the most recent successful deploy. Null until the first deploy succeeds."
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "id",
          "name",
          "deploy_status",
          "created_at",
          "updated_at"
        ]
      },
      "FunctionDetail": {
        "type": "object",
        "description": "Full function record returned by GET / PUT.",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "name": {
            "type": "string"
          },
          "code": {
            "type": "string",
            "description": "The bundled handler source. UTF-8 string up to 1 MiB. The\nsame value most recently passed as `code` to POST or PUT.\n"
          },
          "deploy_status": {
            "$ref": "#/components/schemas/FunctionDeployStatus"
          },
          "deploy_error": {
            "type": [
              "string",
              "null"
            ],
            "description": "Error message from the most recent failed deploy, or null\nafter a successful deploy. Surface this to users to explain\na `failed` status without polling.\n"
          },
          "deployed_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "id",
          "name",
          "code",
          "deploy_status",
          "created_at",
          "updated_at"
        ]
      },
      "CreateFunctionInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "name": {
            "type": "string",
            "pattern": "^[a-z0-9_-]{1,64}$",
            "description": "Slug-style name. Lowercase letters, digits, hyphens, and\nunderscores. 1 to 64 characters. Must be unique within the\norg; a 409 is returned on collision.\n"
          },
          "code": {
            "type": "string",
            "minLength": 1,
            "maxLength": 1048576,
            "description": "Pre-built handler as a single ESM module. Up to 1 MiB UTF-8.\nMust export a default `{ async fetch(req, env, ctx) { ... } }`\nobject. Provide either `code` or `files`, not both.\n"
          },
          "sourceMap": {
            "type": "string",
            "minLength": 1,
            "maxLength": 5242880,
            "description": "Optional source map for the bundle. Up to 5 MiB UTF-8.\nStored with the deployment attempt and sent to the runtime\nto symbolicate stack traces in the function's logs. Only\nvalid with `code`.\n"
          },
          "files": {
            "type": "object",
            "additionalProperties": {
              "type": "string"
            },
            "description": "Source files for a managed build, as a map of path to file\ncontents (for example {\"package.json\": \"...\",\n\"src/index.ts\": \"...\"}). Provide this INSTEAD of `code` to\nhave the server install dependencies and bundle the source\nfor the Workers runtime before deploying. Include a\npackage.json (its `dependencies` are installed). Provide\neither `code` or `files`, not both.\n"
          }
        },
        "required": [
          "name"
        ]
      },
      "CreateFunctionResult": {
        "type": "object",
        "description": "Returned by POST /functions on a successful deploy.",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "name": {
            "type": "string"
          },
          "deploy_status": {
            "$ref": "#/components/schemas/FunctionDeployStatus"
          }
        },
        "required": [
          "id",
          "name",
          "deploy_status"
        ]
      },
      "UpdateFunctionInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "code": {
            "type": "string",
            "minLength": 1,
            "maxLength": 1048576,
            "description": "New pre-built handler. Same rules as CreateFunctionInput.code. Provide either `code` or `files`, not both."
          },
          "sourceMap": {
            "type": "string",
            "minLength": 1,
            "maxLength": 5242880
          },
          "files": {
            "type": "object",
            "additionalProperties": {
              "type": "string"
            },
            "description": "Source files for a managed build, as a map of path to file\ncontents. Provide this INSTEAD of `code` to rebuild and\nredeploy from source. Same rules as CreateFunctionInput.files.\n"
          }
        },
        "required": []
      },
      "TestInvocationResult": {
        "type": "object",
        "description": "Metadata returned by POST /functions/{id}/test. The send is\nqueued; poll `trace_url` to watch the run progress through\nsend -> inbound -> webhook deliveries -> outbound requests,\nlogs, and replies.\n",
        "properties": {
          "test_run_id": {
            "type": "string",
            "format": "uuid",
            "description": "Durable test run id used to fetch the run trace."
          },
          "inbound_domain": {
            "type": "string",
            "description": "Verified inbound domain the test email was sent to."
          },
          "to": {
            "type": "string",
            "description": "Synthetic local-part plus inbound_domain. Visible in the org's inbox."
          },
          "from": {
            "type": "string",
            "description": "Primitive-controlled outbound sender used for the test."
          },
          "send_id": {
            "type": "string",
            "description": "Outbound message id from the underlying send. NOT the\ninbound email's id; the inbound id is created when the\nemail arrives via MX and lands on the function's\ninvocations list.\n"
          },
          "subject": {
            "type": "string",
            "description": "Subject placed on the test email so it can be located in the inbox."
          },
          "poll_since": {
            "type": "string",
            "format": "date-time",
            "description": "ISO timestamp suitable as a `since` lower bound when\npolling /emails for the inbound's arrival. Captured\nslightly before the send to absorb light clock skew.\n"
          },
          "watch_url": {
            "type": "string",
            "format": "uri",
            "description": "Function detail page where invocations show up live."
          },
          "trace_url": {
            "type": "string",
            "description": "Relative API URL for GET /functions/{id}/test-runs/{test_run_id}/trace."
          }
        },
        "required": [
          "test_run_id",
          "inbound_domain",
          "to",
          "from",
          "send_id",
          "subject",
          "poll_since",
          "watch_url",
          "trace_url"
        ]
      },
      "FunctionTestRunState": {
        "type": "string",
        "description": "High-level state for a function test run trace:\n  - `send_failed`: the initial test email send failed.\n  - `waiting_for_send`: the test run was created but no send result has been recorded yet.\n  - `waiting_for_inbound`: the test send was queued and the matching inbound email has not arrived yet.\n  - `waiting_for_function`: the inbound email arrived and webhook/function processing is still in flight.\n  - `completed`: the function webhook completed successfully.\n  - `failed`: webhook delivery exhausted retries.\n",
        "enum": [
          "send_failed",
          "waiting_for_send",
          "waiting_for_inbound",
          "waiting_for_function",
          "completed",
          "failed"
        ]
      },
      "FunctionTestRun": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "function_id": {
            "type": "string",
            "format": "uuid"
          },
          "inbound_domain": {
            "type": "string"
          },
          "to": {
            "type": "string"
          },
          "from": {
            "type": "string"
          },
          "subject": {
            "type": "string"
          },
          "poll_since": {
            "type": "string",
            "format": "date-time"
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          },
          "sent_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "send_error": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "id",
          "function_id",
          "inbound_domain",
          "to",
          "from",
          "subject",
          "poll_since",
          "created_at",
          "sent_at",
          "send_error"
        ]
      },
      "FunctionTestRunSend": {
        "type": [
          "object",
          "null"
        ],
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "status": {
            "$ref": "#/components/schemas/SentEmailStatus"
          },
          "queue_id": {
            "type": [
              "string",
              "null"
            ]
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "id",
          "status",
          "queue_id",
          "created_at",
          "updated_at"
        ]
      },
      "FunctionTestRunInboundEmail": {
        "type": [
          "object",
          "null"
        ],
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "status": {
            "$ref": "#/components/schemas/EmailStatus"
          },
          "received_at": {
            "type": "string",
            "format": "date-time"
          },
          "from": {
            "type": "string"
          },
          "to": {
            "type": "string"
          },
          "subject": {
            "type": [
              "string",
              "null"
            ]
          },
          "webhook_status": {
            "$ref": "#/components/schemas/EmailWebhookStatus"
          },
          "webhook_attempt_count": {
            "type": "integer"
          },
          "webhook_last_status_code": {
            "type": [
              "integer",
              "null"
            ]
          },
          "webhook_last_error": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "id",
          "status",
          "received_at",
          "from",
          "to",
          "subject",
          "webhook_status",
          "webhook_attempt_count",
          "webhook_last_status_code",
          "webhook_last_error"
        ]
      },
      "FunctionTestRunDeliveryEndpoint": {
        "type": [
          "object",
          "null"
        ],
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "kind": {
            "type": "string",
            "description": "Endpoint kind. Current traces may include `http` or `function`; future endpoint kinds may appear."
          },
          "function_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid"
          },
          "function_name": {
            "type": [
              "string",
              "null"
            ]
          },
          "domain_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid"
          },
          "enabled": {
            "type": "boolean"
          },
          "deactivated_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "is_current_function": {
            "type": "boolean"
          }
        },
        "required": [
          "id",
          "kind",
          "function_id",
          "function_name",
          "domain_id",
          "enabled",
          "deactivated_at",
          "is_current_function"
        ]
      },
      "FunctionTestRunDelivery": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "Webhook delivery id."
          },
          "endpoint_id": {
            "type": "string",
            "format": "uuid"
          },
          "endpoint_url": {
            "type": "string",
            "format": "uri"
          },
          "status": {
            "type": "string",
            "enum": [
              "pending",
              "delivered",
              "header_confirmed",
              "failed"
            ]
          },
          "attempt_count": {
            "type": "integer"
          },
          "duration_ms": {
            "type": [
              "integer",
              "null"
            ]
          },
          "last_error": {
            "type": [
              "string",
              "null"
            ]
          },
          "last_error_code": {
            "type": [
              "string",
              "null"
            ]
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time"
          },
          "endpoint": {
            "$ref": "#/components/schemas/FunctionTestRunDeliveryEndpoint"
          }
        },
        "required": [
          "id",
          "endpoint_id",
          "endpoint_url",
          "status",
          "attempt_count",
          "duration_ms",
          "last_error",
          "last_error_code",
          "created_at",
          "updated_at",
          "endpoint"
        ]
      },
      "FunctionTestRunOutboundRequest": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "function_id": {
            "type": "string",
            "format": "uuid"
          },
          "webhook_delivery_id": {
            "type": [
              "string",
              "null"
            ]
          },
          "email_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid"
          },
          "endpoint_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid"
          },
          "method": {
            "type": "string"
          },
          "url": {
            "type": "string",
            "format": "uri"
          },
          "host": {
            "type": "string"
          },
          "path": {
            "type": "string"
          },
          "status_code": {
            "type": [
              "integer",
              "null"
            ]
          },
          "ok": {
            "type": [
              "boolean",
              "null"
            ]
          },
          "duration_ms": {
            "type": "integer"
          },
          "error": {
            "type": [
              "string",
              "null"
            ]
          },
          "ts": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "id",
          "function_id",
          "webhook_delivery_id",
          "email_id",
          "endpoint_id",
          "method",
          "url",
          "host",
          "path",
          "status_code",
          "ok",
          "duration_ms",
          "error",
          "ts"
        ]
      },
      "FunctionTestRunReply": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "status": {
            "$ref": "#/components/schemas/SentEmailStatus"
          },
          "to": {
            "type": "string"
          },
          "subject": {
            "type": "string"
          },
          "queue_id": {
            "type": [
              "string",
              "null"
            ]
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "id",
          "status",
          "to",
          "subject",
          "queue_id",
          "created_at"
        ]
      },
      "FunctionTestRunTrace": {
        "type": "object",
        "description": "End-to-end trace for a `POST /functions/{id}/test` run. The\nshape is stable, but many nested sections are null or empty\nuntil the corresponding phase has happened.\n",
        "properties": {
          "state": {
            "$ref": "#/components/schemas/FunctionTestRunState"
          },
          "test_run": {
            "$ref": "#/components/schemas/FunctionTestRun"
          },
          "test_send": {
            "$ref": "#/components/schemas/FunctionTestRunSend"
          },
          "inbound_email": {
            "$ref": "#/components/schemas/FunctionTestRunInboundEmail"
          },
          "deliveries": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/FunctionTestRunDelivery"
            }
          },
          "outbound_requests": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/FunctionTestRunOutboundRequest"
            }
          },
          "logs": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/FunctionLogRow"
            }
          },
          "replies": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/FunctionTestRunReply"
            }
          }
        },
        "required": [
          "state",
          "test_run",
          "test_send",
          "inbound_email",
          "deliveries",
          "outbound_requests",
          "logs",
          "replies"
        ]
      },
      "FunctionLogRow": {
        "type": "object",
        "description": "One row from GET /functions/{id}/logs. Represents a single\ncaptured log line emitted by the running handler (e.g. via\n`console.log` / `console.error`).\n",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid",
            "description": "Unique log row id (stable across pages)."
          },
          "function_id": {
            "type": "string",
            "format": "uuid",
            "description": "The function this log row belongs to."
          },
          "level": {
            "type": "string",
            "enum": [
              "debug",
              "log",
              "info",
              "warn",
              "error"
            ],
            "description": "Severity. `log` is the runtime's default for unannotated\n`console.log` calls; the other levels match standard\n`console.*` methods.\n"
          },
          "message": {
            "type": "string",
            "description": "The textual message body. The runtime stringifies non-string\narguments before persisting, so this is always a plain\nstring.\n"
          },
          "ts": {
            "type": "string",
            "format": "date-time",
            "description": "When the handler emitted this line. Newest-first ordering\non this column drives pagination; clock is the runtime's,\nnot the gateway's.\n"
          },
          "metadata": {
            "type": [
              "object",
              "null"
            ],
            "additionalProperties": true,
            "description": "Optional structured payload the runtime attaches alongside\nthe message (e.g. extra args passed to `console.log`).\nShape is opaque; treat keys as untyped.\n"
          }
        },
        "required": [
          "id",
          "function_id",
          "level",
          "message",
          "ts"
        ]
      },
      "FunctionSecretListItem": {
        "type": "object",
        "description": "One row from GET /functions/{id}/secrets. Discriminate on the\n`managed` field:\n  * `managed = true`  — system secret provisioned by Primitive.\n    `description` is set; `created_at` / `updated_at` are\n    null because the row is virtual (resolved at deploy time\n    from the managed registry, not stored in the secrets\n    table).\n  * `managed = false` — secret the user set via the API.\n    `created_at` / `updated_at` are set; `description` is\n    null.\n",
        "properties": {
          "key": {
            "type": "string"
          },
          "managed": {
            "type": "boolean",
            "description": "True for managed system secrets, false for user-set entries."
          },
          "description": {
            "type": [
              "string",
              "null"
            ],
            "description": "Set on managed entries only; null on user-set entries."
          },
          "created_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time",
            "description": "Set on user-set entries only; null on managed entries."
          },
          "updated_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time",
            "description": "Set on user-set entries only; null on managed entries."
          }
        },
        "required": [
          "key",
          "managed"
        ]
      },
      "CreateFunctionSecretInput": {
        "type": "object",
        "additionalProperties": false,
        "description": "Body for POST /functions/{id}/secrets.",
        "properties": {
          "key": {
            "type": "string",
            "pattern": "^[A-Z_][A-Z0-9_]*$",
            "description": "Uppercase letters, digits, and underscores. Must start with\na letter or underscore. System-managed keys (e.g.\nPRIMITIVE_WEBHOOK_SECRET, PRIMITIVE_API_KEY, and\nPRIMITIVE_API_BASE_URL) are reserved.\n"
          },
          "value": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4096,
            "description": "Secret value, up to 4096 UTF-8 bytes. Encrypted at rest.\nNever returned by any read endpoint.\n"
          }
        },
        "required": [
          "key",
          "value"
        ]
      },
      "SetFunctionSecretInput": {
        "type": "object",
        "additionalProperties": false,
        "description": "Body for PUT /functions/{id}/secrets/{key}. Key comes from the path.",
        "properties": {
          "value": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4096
          }
        },
        "required": [
          "value"
        ]
      },
      "FunctionSecretWriteResult": {
        "type": "object",
        "description": "Returned by POST and PUT secret routes.",
        "properties": {
          "key": {
            "type": "string"
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time"
          },
          "created": {
            "type": "boolean",
            "description": "True if this call inserted a new row, false if it updated an existing one."
          }
        },
        "required": [
          "key",
          "created_at",
          "updated_at",
          "created"
        ]
      }
    }
  }
};
