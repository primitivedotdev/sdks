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
      "url": "https://api.primitive.dev/v1",
      "description": "Canonical API host (PRIMITIVE_API_BASE_URL). Carries every public\nAPI operation. Cloudflare Workers-backed; attachment-capable send\noperations can carry up to ~30 MiB raw request bodies before base64\nencoding.\n"
    },
    {
      "url": "https://www.primitive.dev/api/v1",
      "description": "Legacy dashboard compatibility host. Requests are forwarded to the\ncanonical API host, but Vercel request body limits still apply before\nproxying. New integrations should use https://api.primitive.dev/v1.\n"
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
      "name": "Routes",
      "description": "Recipient routing: route inbound mail to a single destination per recipient\naddress. Rules bind an address pattern (exact or wildcard) to an endpoint;\n`function_id` routes an address to a function, minting its route-target\nendpoint.\n"
    },
    {
      "name": "Payments",
      "description": "Collect and pay stablecoin (USDC) payments with x402. Settlement is\nnon-custodial: funds move directly from payer to payee on-chain via an\nEIP-3009 authorization the payer signs with their own key, and Primitive\nnever holds funds. The payee registers a payout address and creates a\nchallenge; the payer signs and settles it under a configurable spend\npolicy (kill-switch, per-payment and per-day caps, payee allowlist).\n"
    },
    {
      "name": "Wake",
      "description": "Wake scheduling: schedule and send typed wake commands to your own\nfunctions over real DKIM-signed email on a cron cadence, and manage the\nper-target allowlist that authorizes which senders may wake a function.\n"
    },
    {
      "name": "Webhook Deliveries",
      "description": "View and replay webhook delivery attempts"
    },
    {
      "name": "Functions",
      "description": "Deploy JavaScript handlers that run on inbound mail. Each function\nis a single ESM module whose default export is an object with an\nasync `fetch(request, env)` method, in the shape of a Workers-style\nhandler. Primitive signs each delivery and forwards the\n`Primitive-Signature` header to the handler; verify the raw request\nbody with `PRIMITIVE_WEBHOOK_SECRET` before trusting the parsed event.\nThe `event` field is `email.received` for normal inbound mail, or a\nmachine-mail type (`email.bounced`, `email.tls_report`,\n`email.dmarc_report`, `email.dmarc_failure`) for bounces and reports;\nthe payload shape is otherwise identical. Code runs on\nPrimitive's edge runtime; there is no infrastructure to manage.\nSecrets land in `env` as encrypted bindings and are refreshed on\nevery redeploy.\n"
    },
    {
      "name": "Memories",
      "description": "Durable org-scoped or function-scoped JSON key-value storage for\nagents and functions. Keys are caller-defined. Function scope is\nalways addressed by the function id UUID, not by function name.\n"
    },
    {
      "name": "Templates",
      "description": "Browse approved Function templates, install deploy-mode templates, and\npoll install progress.\n"
    },
    {
      "name": "Registries",
      "description": "The Agent Registry: ownable directories of agents, addressable by a\nregistry-scoped handle. A registry's publish policy (owner_only, request,\nor open) decides whether a publish lists immediately or pends owner\napproval. An agent is defined once with a globally unique,\nreachability-verified address, then published into any registry under a\nhandle. Discovery reads (list, resolve, get) are public for public\nregistries; managing a registry and moderating requests use the owner's\nAPI key.\n"
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
        "description": "Starts a terminal-native CLI signup. `signup_code` is optional;\nomit it to sign up without one. The API creates a pending signup\nsession, sends an email verification code, and returns an opaque\nsignup token used by the resend and verify steps. This endpoint\ndoes not require an API key.\n",
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
        "description": "Verifies the email code for a CLI signup session and creates the\naccount. When the session was started with a `signup_code`, the\nreserved code is redeemed; sessions started without a code skip\nthe redemption step. Either way an org-scoped OAuth CLI session\nis created and the token set is returned exactly once. This\nendpoint does not require an API key.\n",
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
        "description": "Starts an agent-native signup session. `signup_code` is optional;\nomit it to sign up without one. The API creates a pending signup\nsession, sends an email verification code, and returns an opaque\nsignup token used by the resend and verify steps. This endpoint\ndoes not require an API key.\n",
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
        "description": "Verifies the email code for an agent signup session and creates\nthe account when needed. When the session was started with a\n`signup_code`, the reserved code is redeemed; sessions started\nwithout a code skip the redemption step. An org-scoped OAuth\nsession for CLI authentication is minted and the raw tokens are\nreturned exactly once. For existing users, the optional `org_id`\nselects which accessible workspace should receive the new\nsession (no signup-code redemption is performed for existing\nusers regardless of how the session was started).\n",
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
    "/agent/accounts": {
      "post": {
        "operationId": "createAgentAccount",
        "summary": "Create an emailless agent account",
        "description": "Creates an emailless agent account without authentication and returns a\none-time API key (prefixed `prim_`) plus a provisioned managed inbox.\nThe account is on the `agent` plan: reply-only (it can send only to\naddresses that have already sent it authenticated mail) with tight send\nlimits. Use the returned `api_key` as a Bearer token on later calls. The\naccount can be upgraded to a full developer account by confirming an\nemail through the claim flow. This endpoint does not require an API key.\n",
        "tags": [
          "Agent"
        ],
        "security": [],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateAgentAccountInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Agent account created; the API key is returned once",
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
                          "$ref": "#/components/schemas/AgentAccountResult"
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
    "/agent/claim/start": {
      "post": {
        "operationId": "startAgentClaim",
        "summary": "Start an agent account email claim",
        "description": "Begins upgrading an emailless `agent` account into a full `developer`\naccount by confirming an email address. Authenticated by the agent's own\nAPI key (the org is taken from the credential). Sends a verification\ncode to the supplied email and returns the claim session id plus resend\ntiming. Submit the code to `/agent/claim/verify` to complete the\nupgrade. Confirming an email that already belongs to a Primitive account\nis rejected.\n",
        "tags": [
          "Agent"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/StartAgentClaimInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Claim started and verification email sent",
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
                          "$ref": "#/components/schemas/AgentClaimStartResult"
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
          "409": {
            "description": "The email is already in use, or the account is not claimable",
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
    "/agent/claim/verify": {
      "post": {
        "operationId": "verifyAgentClaim",
        "summary": "Verify an agent account email claim",
        "description": "Confirms the verification code emailed by `/agent/claim/start` and\nupgrades the account to the `developer` plan. The org id, API key, and\nmanaged inbox all carry over; the send cap lifts. Authenticated by the\nagent's own API key.\n",
        "tags": [
          "Agent"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/VerifyAgentClaimInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Claim verified; account upgraded to developer",
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
                          "$ref": "#/components/schemas/AgentClaimResult"
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
          "409": {
            "description": "The account is already claimed, or the email is in use",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "410": {
            "description": "The claim or its verification code has expired",
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
    "/agent/claim/link": {
      "post": {
        "operationId": "createAgentClaimLink",
        "summary": "Create a browser claim link",
        "description": "Mints an opaque, single-use link an agent can hand to a human to\ncomplete the email-confirmation upgrade in a browser. Authenticated by\nthe agent's own API key. `claim_url` is null when the API host cannot\nresolve a web origin to build the link.\n",
        "tags": [
          "Agent"
        ],
        "requestBody": {
          "required": false,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateAgentClaimLinkInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Claim link created",
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
                          "$ref": "#/components/schemas/AgentClaimLinkResult"
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
          },
          "409": {
            "description": "The account is not claimable (not an agent account, or already claimed)",
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
          },
          {
            "name": "since",
            "in": "query",
            "schema": {
              "type": "string",
              "maxLength": 200
            },
            "description": "Forward-tail cursor. Returns rows that became visible AFTER this\ncursor, oldest-first, so a caller can stream new inbound mail by\nre-passing the cursor from each response. Mutually exclusive with\n`cursor` (which pages history newest-first). Pass the `meta.cursor`\nfrom the previous `since` response; an empty page means caught up.\n"
          },
          {
            "name": "wait",
            "in": "query",
            "schema": {
              "type": "integer",
              "minimum": 0,
              "maximum": 30
            },
            "description": "Long-poll: hold the request up to this many seconds waiting for new\nmail past `since`, returning as soon as any arrives (or an empty\npage when the wait elapses). Requires `since`. Omitted means no wait\n(returns immediately); the server treats an absent value as 0. NOT\ngiven an OpenAPI `default` on purpose: a default makes some\ngenerators (e.g. openapi-python-client) send `wait=0` on every call,\nwhich then fails the `wait` requires `since` check for plain history\nlistings.\n"
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
            "description": "Canonical API host (recommended)"
          },
          {
            "url": "https://www.primitive.dev/api/v1",
            "description": "Legacy compatibility host (Vercel body limit applies)"
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
    "/wake/schedules": {
      "get": {
        "operationId": "listWakeSchedules",
        "summary": "List wake schedules",
        "description": "Returns the org's wake.dispatch schedules.",
        "tags": [
          "Wake"
        ],
        "responses": {
          "200": {
            "description": "List of wake schedules",
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
                            "$ref": "#/components/schemas/WakeSchedule"
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
        "operationId": "createWakeSchedule",
        "summary": "Create a wake schedule",
        "description": "Create a cron schedule that sends a wake.dispatch command to one of your\nown function addresses. `from` and `to` must differ (no self-dispatch);\nthe cron expression and IANA timezone are validated and the first fire\ntime is computed without firing immediately.\n",
        "tags": [
          "Wake"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateWakeScheduleInput"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Wake schedule created",
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
                          "$ref": "#/components/schemas/WakeSchedule"
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
    "/wake/schedules/{id}": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "get": {
        "operationId": "getWakeSchedule",
        "summary": "Get a wake schedule",
        "tags": [
          "Wake"
        ],
        "responses": {
          "200": {
            "description": "The wake schedule",
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
                          "$ref": "#/components/schemas/WakeSchedule"
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
        "operationId": "updateWakeSchedule",
        "summary": "Update a wake schedule",
        "description": "Update a schedule's command, args, cadence, addresses, note, or enabled\nstate. Changing the cadence (or re-enabling) recomputes the next fire time.\n",
        "tags": [
          "Wake"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateWakeScheduleInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Updated wake schedule",
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
                          "$ref": "#/components/schemas/WakeSchedule"
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
        "operationId": "deleteWakeSchedule",
        "summary": "Delete a wake schedule",
        "tags": [
          "Wake"
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
          }
        }
      }
    },
    "/wake/schedules/{id}/run": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "post": {
        "operationId": "runWakeSchedule",
        "summary": "Run a wake schedule now",
        "description": "Fire the schedule immediately, sending one wake.dispatch via the same\nsigned-send path as a scheduled fire. Does not change the schedule's next\nfire time.\n",
        "tags": [
          "Wake"
        ],
        "responses": {
          "200": {
            "description": "The wake interaction that was emitted",
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
                          "additionalProperties": true
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
    "/wake/authorizations": {
      "get": {
        "operationId": "listWakeAuthorizations",
        "summary": "List wake authorizations",
        "description": "Returns the per-target allowlist grants that authorize which senders may\nwake a function. Optionally filter by the target endpoint.\n",
        "tags": [
          "Wake"
        ],
        "parameters": [
          {
            "name": "recipient_endpoint_id",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "description": "Only return grants for this target endpoint"
          }
        ],
        "responses": {
          "200": {
            "description": "List of wake authorizations",
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
                            "$ref": "#/components/schemas/WakeAuthorization"
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
      },
      "post": {
        "operationId": "createWakeAuthorization",
        "summary": "Create a wake authorization",
        "description": "Grant a sender domain (and optionally a specific address and command set)\npermission to wake a target function. The domain must be fully-qualified.\n",
        "tags": [
          "Wake"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateWakeAuthorizationInput"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Wake authorization created",
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
                          "$ref": "#/components/schemas/WakeAuthorization"
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
          "409": {
            "$ref": "#/components/responses/Conflict"
          }
        }
      }
    },
    "/wake/authorizations/{id}": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "patch": {
        "operationId": "updateWakeAuthorization",
        "summary": "Update a wake authorization",
        "description": "Toggle a wake authorization's enabled state.",
        "tags": [
          "Wake"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateWakeAuthorizationInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Updated wake authorization",
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
                          "$ref": "#/components/schemas/WakeAuthorization"
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
        "operationId": "deleteWakeAuthorization",
        "summary": "Delete a wake authorization",
        "tags": [
          "Wake"
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
          }
        }
      }
    },
    "/wake/dispatches": {
      "get": {
        "operationId": "listWakeDispatches",
        "summary": "List recent wake dispatches",
        "description": "Read-only audit of recent wake.dispatch interactions for the org.",
        "tags": [
          "Wake"
        ],
        "parameters": [
          {
            "name": "limit",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "minimum": 1,
              "maximum": 200,
              "default": 50
            },
            "description": "Maximum number of rows to return (1-200, default 50)"
          }
        ],
        "responses": {
          "200": {
            "description": "List of recent wake dispatches",
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
                            "$ref": "#/components/schemas/WakeDispatch"
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
      }
    },
    "/routes": {
      "get": {
        "operationId": "listRoutes",
        "summary": "List recipient routes",
        "description": "Returns the org's recipient routing rules in evaluation order. Each rule\nbinds a recipient address pattern to one endpoint; inbound mail resolves\nto a single destination at delivery time.\n",
        "tags": [
          "Routes"
        ],
        "responses": {
          "200": {
            "description": "List of routes",
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
                            "$ref": "#/components/schemas/RecipientRoute"
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
        "operationId": "createRoute",
        "summary": "Create a recipient route",
        "description": "Binds a recipient pattern to a destination. Provide exactly one of\n`endpoint_id` (an existing endpoint) or `function_id`. With `function_id`,\na dedicated route-target endpoint is minted for that function in the same\ntransaction, enabling per-address function routing (e.g.\n`alice@acme.com -> functionA`).\n",
        "tags": [
          "Routes"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateRouteInput"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Route created",
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
                          "$ref": "#/components/schemas/RecipientRoute"
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
          "409": {
            "$ref": "#/components/responses/Conflict"
          }
        }
      }
    },
    "/routes/reorder": {
      "post": {
        "operationId": "reorderRoutes",
        "summary": "Reorder recipient routes",
        "description": "Update the priority of one or more routes in a single call.",
        "tags": [
          "Routes"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ReorderRoutesInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Updated route list",
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
                            "$ref": "#/components/schemas/RecipientRoute"
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
    "/routes/simulate": {
      "post": {
        "operationId": "simulateRoute",
        "summary": "Simulate routing for a recipient",
        "description": "Resolves where an inbound email to `recipient` would be delivered, with a\ntrace of every rule evaluated and why. Read-only; creates nothing.\n",
        "tags": [
          "Routes"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SimulateRouteInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Routing decision",
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
                          "$ref": "#/components/schemas/SimulateRouteResult"
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
    "/routes/{id}": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "patch": {
        "operationId": "updateRoute",
        "summary": "Update a recipient route",
        "tags": [
          "Routes"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateRouteInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Updated route",
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
                          "$ref": "#/components/schemas/RecipientRoute"
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
          "409": {
            "$ref": "#/components/responses/Conflict"
          }
        }
      },
      "delete": {
        "operationId": "deleteRoute",
        "summary": "Delete a recipient route",
        "tags": [
          "Routes"
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
        "description": "Sends an outbound email through Primitive's outbound relay. By default\nthe request returns once the relay accepts the message for delivery.\nSet `wait: true` to wait for the first downstream SMTP delivery outcome.\n\n**Host routing.** /send-mail is served by the canonical API host\n(`https://api.primitive.dev/v1`) so the request body can carry\ninline attachments up to ~30 MiB raw. The legacy dashboard\ncompatibility host (`https://www.primitive.dev/api/v1`) also accepts\n/send-mail, but Vercel request body limits apply before proxying.\nThe typed SDKs route /send-mail to the canonical API host\nautomatically.\n",
        "servers": [
          {
            "url": "https://api.primitive.dev/v1",
            "description": "Canonical API host (recommended)"
          },
          {
            "url": "https://www.primitive.dev/api/v1",
            "description": "Legacy compatibility host (Vercel body limit applies)"
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
    "/sent-emails/{id}/reply": {
      "get": {
        "operationId": "awaitReply",
        "summary": "Get (or wait for) the reply to a sent email",
        "description": "Returns the first threaded inbound reply to a send, keyed by\nthe inbound email's `reply_to_sent_email_id`. This is the\ncanonical \"did a reply arrive for this send?\" call: after\n/send-mail, poll (or long-poll) here instead of hand-rolling\nan /emails/search loop.\n\nBy default the call returns immediately with `reply: null`\nwhen nothing has arrived yet. Set `wait=true` to long-poll:\nthe server holds the request up to `wait_timeout_ms`\n(default 10000, max 30000), returning as soon as the first\nreply lands. On a wait that elapses with no reply, the\nresponse has `reply: null` and `timed_out: true`.\n\nThe reply object is compact (headers plus bodies); fetch\n`/emails/{id}` with `reply.id` for the fully parsed record,\nor `/threads/{thread_id}` for the whole back-and-forth.\n",
        "tags": [
          "Sending"
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/ResourceId"
          },
          {
            "name": "wait",
            "in": "query",
            "schema": {
              "type": "boolean"
            },
            "description": "When true, long-poll up to `wait_timeout_ms` for the\nfirst reply to arrive instead of returning immediately.\nMirrors send-mail's server-side `wait` semantics. The\nserver accepts only the literal strings `true` / `false`\n(standard boolean query serialization); omitted means\nno wait.\n"
          },
          {
            "name": "wait_timeout_ms",
            "in": "query",
            "schema": {
              "type": "integer",
              "minimum": 1000,
              "maximum": 30000
            },
            "description": "Maximum time to hold the request when `wait=true`.\nServer default is 10000. NOT given an OpenAPI `default`\non purpose, matching the `/emails` `wait` parameter: a\ndefault makes some generators send the value on every\ncall.\n"
          }
        ],
        "responses": {
          "200": {
            "description": "Reply status for the send (reply may be null)",
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
                          "$ref": "#/components/schemas/AwaitReplyResult"
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
        "description": "Creates and deploys a new function. The handler must be a single\nESM module whose default export is an object with an async\n`fetch(request, env)` method (Workers-style). Primitive signs\neach delivery and forwards the `Primitive-Signature` header to\nthe handler. Verify the raw request body with\n`PRIMITIVE_WEBHOOK_SECRET` before parsing JSON; after verification\nthe request body parses to a webhook event whose `event` field is\n`email.received` for normal inbound mail, or a machine-mail type\n(`email.bounced`, `email.tls_report`, `email.dmarc_report`,\n`email.dmarc_failure`) for bounces and reports. Code is bundled\nbefore being uploaded; ship a single self-contained file rather\nthan relying on external imports.\n\n**Code limits.** `code` is capped at 1 MiB UTF-8. `sourceMap`\n(optional) is capped at 5 MiB UTF-8, stored with each deployment\nattempt, and sent to the runtime so stack traces can resolve to\noriginal source files.\n\n**Routing.** On successful deploy, the function code is live\nin the runtime, but inbound mail will not reach it until at\nleast one route is bound. Routes are managed from the Primitive\ndashboard. A `deploy_status` of `deployed` means the script is\ninstalled, not that the function is receiving mail. The\ninternal runtime URL is not returned by the API and is not a\ncustomer-facing integration surface.\n\n**Secrets.** New functions ship with the managed secrets\n(`PRIMITIVE_WEBHOOK_SECRET`, `PRIMITIVE_API_KEY`,\n`PRIMITIVE_API_BASE_URL`) already bound. Add user-set secrets via\n`POST /functions/{id}/secrets`; secret writes only land in the\nrunning handler on the next redeploy.\n",
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
        "description": "Soft-deletes the function row, removes the script from the edge\nruntime, and deactivates any route bound to this function so no\nfurther inbound mail is delivered. Past deploy history,\ninvocations, and logs are retained.\n\nReturns 502 if the runtime delete fails partway; the function\nrow stays in place and the call is safe to retry until it\nsucceeds.\n",
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
    "/functions/routing-topology": {
      "get": {
        "operationId": "getOrgRoutingTopology",
        "summary": "Get the org's function routing topology",
        "description": "Returns a single snapshot of how inbound mail is routed across\nthis org's active domains and functions: which active domain has\nwhich function bound, the org's fallback function (if any), and\nevery deployed function with no route bound. Use this to answer\n\"which of my functions actually receive mail?\" diagnostically.\n",
        "tags": [
          "Functions"
        ],
        "responses": {
          "200": {
            "description": "Routing topology",
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
                          "$ref": "#/components/schemas/RoutingTopology"
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
          "403": {
            "$ref": "#/components/responses/Forbidden"
          }
        }
      }
    },
    "/functions/{id}/routing": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "get": {
        "operationId": "getFunctionRouting",
        "summary": "Get a function's current route binding",
        "description": "Returns the endpoint binding for the function, or null when no\nroute is currently bound. The binding identifies whether the\nfunction receives mail for a specific domain (scoped) or for any\nactive domain that has no scoped binding (fallback).\n",
        "tags": [
          "Functions"
        ],
        "responses": {
          "200": {
            "description": "Function routing",
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
                          "oneOf": [
                            {
                              "$ref": "#/components/schemas/FunctionRouting"
                            },
                            {
                              "type": "null"
                            }
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
      }
    },
    "/functions/{id}/route": {
      "parameters": [
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "put": {
        "operationId": "setFunctionRoute",
        "summary": "Bind a route to a function",
        "description": "Binds inbound mail to this function. The route target is either\na specific verified domain (scoped) or the org's fallback (any\nactive domain with no scoped binding). If another function is\nalready bound at the target, returns a `conflict` envelope\ndescribing the holder; re-issue with `takeover: true` to\ndeactivate that prior binding and install this one.\n",
        "tags": [
          "Functions"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/FunctionRouteBody"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Route bound, or conflict requiring takeover",
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
                          "$ref": "#/components/schemas/FunctionRouteResult"
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
        "operationId": "unsetFunctionRoute",
        "summary": "Unbind any route from a function",
        "description": "Deactivates every active endpoint bound to this function. The\nfunction stays deployed but stops receiving inbound mail. Safe\nto call when no route is currently bound (no-op).\n",
        "tags": [
          "Functions"
        ],
        "responses": {
          "200": {
            "description": "Route unbound",
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
                            "unrouted": {
                              "type": "boolean",
                              "enum": [
                                true
                              ]
                            }
                          },
                          "required": [
                            "unrouted"
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
    "/org/secrets": {
      "get": {
        "operationId": "listOrgSecrets",
        "summary": "List org-level (global) secrets",
        "description": "Returns metadata for every org-level secret. Org secrets apply\nto every function in the org and are read as `env.<KEY>` in\nhandlers. **Values are never returned.** Secret writes are\nwrite-only. A function-level secret of the same name overrides\nthe org-level value for that function.\n",
        "tags": [
          "Functions"
        ],
        "responses": {
          "200": {
            "description": "List of org secrets (metadata only, no values)",
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
                                "$ref": "#/components/schemas/OrgSecretListItem"
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
          }
        }
      },
      "post": {
        "operationId": "createOrgSecret",
        "summary": "Create or update an org secret",
        "description": "Idempotent insert-or-update keyed on `(org_id, key)`. Returns\n201 the first time the key is set, 200 on subsequent updates.\nValues are encrypted at rest. A changed value lands in a\nfunction only on that function's next deploy.\n\nKeys must match `^[A-Z_][A-Z0-9_]*$` (uppercase letters,\ndigits, underscores; first character is a letter or\nunderscore). Values are at most 4096 UTF-8 bytes. System-\nmanaged keys are reserved and rejected.\n",
        "tags": [
          "Functions"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateOrgSecretInput"
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
                          "$ref": "#/components/schemas/OrgSecretWriteResult"
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
                          "$ref": "#/components/schemas/OrgSecretWriteResult"
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
    "/org/secrets/{key}": {
      "parameters": [
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
        "operationId": "setOrgSecret",
        "summary": "Set an org secret by key",
        "description": "Path-keyed companion to `POST /org/secrets`. Idempotent:\nreturns 201 the first time the key is set, 200 on subsequent\nupdates. Same validation and write-only guarantees as POST.\n",
        "tags": [
          "Functions"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SetOrgSecretInput"
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
                          "$ref": "#/components/schemas/OrgSecretWriteResult"
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
                          "$ref": "#/components/schemas/OrgSecretWriteResult"
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
      },
      "delete": {
        "operationId": "deleteOrgSecret",
        "summary": "Delete an org secret",
        "description": "Removes the org secret. Functions keep the previous value until\neach is redeployed. Returns 404 if the key did not exist.\n",
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
    },
    "/memories": {
      "put": {
        "operationId": "setMemory",
        "summary": "Set a memory",
        "description": "Create or update a durable JSON memory under an org or function scope.\nWhen no explicit scope is provided, function-authenticated requests\nuse that function's id automatically; requests with\n`x-primitive-function-id` use that function id; all other requests\ndefault to org scope.\n\n`scope.type = function` requires the function id UUID in `scope.id`.\nFunction names are not accepted as scope identifiers. Values must be\nvalid JSON and serialize to at most 65536 UTF-8 bytes. Keys must be at\nmost 512 UTF-8 bytes. `version`, `read_count`, and `write_count` are\nbigint counters serialized as strings.\n\nPassing `if_absent` turns the write into create-only. Passing\n`if_version` turns the write into compare-and-set. These options are\nmutually exclusive and return `memory_conflict` on a stale version or\nexisting key.\n",
        "tags": [
          "Memories"
        ],
        "parameters": [
          {
            "name": "x-primitive-function-id",
            "in": "header",
            "required": false,
            "description": "Optional function id UUID used as the default scope when the body\ndoes not include `scope`. Ignored when `scope` is provided.\n",
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SetMemoryInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Existing memory updated",
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
                          "$ref": "#/components/schemas/MemoryRecordWithValue"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "201": {
            "description": "Memory created",
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
                          "$ref": "#/components/schemas/MemoryRecordWithValue"
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
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "409": {
            "$ref": "#/components/responses/Conflict"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      },
      "get": {
        "operationId": "getMemory",
        "summary": "Get a memory",
        "description": "Fetch one active memory by key and scope. Omit scope parameters to use\nthe automatic default: function-authenticated context, then the\n`x-primitive-function-id` header, then org scope. Function scope uses a\nfunction id UUID in `scope_id`.\n\nA successful read records memory read usage and updates the memory's\nread stats asynchronously.\n",
        "tags": [
          "Memories"
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/MemoryKeyQuery"
          },
          {
            "$ref": "#/components/parameters/MemoryScopeQueryType"
          },
          {
            "$ref": "#/components/parameters/MemoryScopeId"
          },
          {
            "name": "x-primitive-function-id",
            "in": "header",
            "required": false,
            "description": "Optional function id UUID used as the default scope when query\nscope parameters are omitted.\n",
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Memory record with value",
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
                          "$ref": "#/components/schemas/MemoryRecordWithValue"
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
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      },
      "delete": {
        "operationId": "deleteMemory",
        "summary": "Delete a memory",
        "description": "Delete one active memory by key and scope. Deletes are idempotent when\n`if_version` is omitted: deleting a missing key returns `deleted:\nfalse`. With `if_version`, a missing key still returns `deleted: false`,\nbut a stale version returns `memory_conflict`.\n\nA successful delete records memory write usage.\n",
        "tags": [
          "Memories"
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/MemoryKeyQuery"
          },
          {
            "$ref": "#/components/parameters/MemoryScopeQueryType"
          },
          {
            "$ref": "#/components/parameters/MemoryScopeId"
          },
          {
            "name": "if_version",
            "in": "query",
            "required": false,
            "description": "Optional compare-and-delete version. If the active memory exists\nat a different version, the API returns `memory_conflict`.\n",
            "schema": {
              "$ref": "#/components/schemas/NumericString"
            }
          },
          {
            "name": "x-primitive-function-id",
            "in": "header",
            "required": false,
            "description": "Optional function id UUID used as the default scope when query\nscope parameters are omitted.\n",
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Delete result",
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
                          "$ref": "#/components/schemas/DeleteMemoryResult"
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
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "409": {
            "$ref": "#/components/responses/Conflict"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      }
    },
    "/memories/search": {
      "get": {
        "operationId": "searchMemories",
        "summary": "Search memories",
        "description": "List active memories in a scope by lexicographic key prefix. Results\nare ordered by key ascending. The `meta.cursor` value is the next key\ncursor; pass it back as `cursor` to continue after that key.\n\nSearch records one memory read usage event for the operation. Pass\n`include_value=false` to return metadata only.\n",
        "tags": [
          "Memories"
        ],
        "parameters": [
          {
            "name": "prefix",
            "in": "query",
            "required": false,
            "description": "Key prefix to match. Empty string lists all active memories in the\nselected scope. Must be at most 512 UTF-8 bytes.\n",
            "schema": {
              "type": "string",
              "maxLength": 512,
              "default": ""
            }
          },
          {
            "name": "cursor",
            "in": "query",
            "required": false,
            "description": "Key cursor from a previous response's `meta.cursor`. The next page\nstarts after this key.\n",
            "schema": {
              "type": "string",
              "minLength": 1,
              "maxLength": 512
            }
          },
          {
            "$ref": "#/components/parameters/Limit"
          },
          {
            "name": "include_value",
            "in": "query",
            "required": false,
            "description": "Pass `false` to omit the `value` field and return metadata only.\n",
            "schema": {
              "type": "string",
              "enum": [
                "true",
                "false"
              ],
              "default": "true"
            }
          },
          {
            "name": "updated_after",
            "in": "query",
            "required": false,
            "description": "Only include memories updated at or after this timestamp.",
            "schema": {
              "type": "string",
              "format": "date-time"
            }
          },
          {
            "name": "updated_before",
            "in": "query",
            "required": false,
            "description": "Only include memories updated at or before this timestamp.",
            "schema": {
              "type": "string",
              "format": "date-time"
            }
          },
          {
            "$ref": "#/components/parameters/MemoryScopeQueryType"
          },
          {
            "$ref": "#/components/parameters/MemoryScopeId"
          },
          {
            "name": "x-primitive-function-id",
            "in": "header",
            "required": false,
            "description": "Optional function id UUID used as the default scope when query\nscope parameters are omitted.\n",
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Paginated memory records",
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
                            "$ref": "#/components/schemas/MemoryRecord"
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
          },
          "402": {
            "$ref": "#/components/responses/PaymentRequired"
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
    "/templates": {
      "get": {
        "operationId": "listTemplates",
        "summary": "List function templates",
        "description": "List approved Function templates available for browsing and\ninstallation. Results are cacheable and paginated with\n`data.next_cursor`.\n",
        "tags": [
          "Templates"
        ],
        "security": [],
        "parameters": [
          {
            "name": "q",
            "in": "query",
            "required": false,
            "description": "Search templates by title, summary, or slug.",
            "schema": {
              "type": "string",
              "minLength": 1
            }
          },
          {
            "name": "tag",
            "in": "query",
            "required": false,
            "description": "Filter templates by an exact tag.",
            "schema": {
              "type": "string",
              "minLength": 1
            }
          },
          {
            "name": "cursor",
            "in": "query",
            "required": false,
            "description": "Cursor from a previous response `data.next_cursor` value.",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "limit",
            "in": "query",
            "required": false,
            "description": "Maximum number of templates to return. The server caps this at 100.",
            "schema": {
              "type": "integer",
              "minimum": 1,
              "maximum": 100,
              "default": 50
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Paginated template registry summaries",
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
                          "$ref": "#/components/schemas/TemplateRegistryPage"
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
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      }
    },
    "/templates/{id}": {
      "get": {
        "operationId": "getTemplate",
        "summary": "Get a function template",
        "description": "Fetch one approved Function template by slug, including its manifest\nsnapshot and README. The stored source files used for install are not\nreturned.\n",
        "tags": [
          "Templates"
        ],
        "security": [],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "description": "Template slug from the template manifest.",
            "schema": {
              "type": "string",
              "pattern": "^[a-z0-9][a-z0-9_-]{0,62}$"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Template registry detail",
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
                          "$ref": "#/components/schemas/TemplateRegistryDetail"
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
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      }
    },
    "/templates/{id}/install": {
      "post": {
        "operationId": "installTemplate",
        "summary": "Install a function template",
        "description": "Start a one-shot deploy of an approved deploy-mode Function template.\nThe response returns an install record immediately; poll\n`GET /templates/installs/{id}` for progress.\n",
        "tags": [
          "Templates"
        ],
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "description": "Template slug from the template manifest.",
            "schema": {
              "type": "string",
              "pattern": "^[a-z0-9][a-z0-9_-]{0,62}$"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/InstallTemplateBody"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Template install started",
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
                          "$ref": "#/components/schemas/TemplateInstallStatus"
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
          "409": {
            "$ref": "#/components/responses/Conflict"
          },
          "422": {
            "$ref": "#/components/responses/UnprocessableEntity"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      }
    },
    "/templates/installs/{id}": {
      "get": {
        "operationId": "getTemplateInstall",
        "summary": "Get template install status",
        "description": "Fetch the current state of a template install. Reads may advance the\nself-test phase when a reply effect has been observed.\n",
        "tags": [
          "Templates"
        ],
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "description": "Template install UUID.",
            "schema": {
              "type": "string",
              "format": "uuid",
              "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Current template install status",
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
                          "$ref": "#/components/schemas/TemplateInstallStatus"
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
          }
        }
      }
    },
    "/x402/payout-addresses": {
      "post": {
        "operationId": "registerPayoutAddress",
        "summary": "Register a payout address",
        "description": "Register (or update) the default payout address your org receives x402\npayments at, for a given network. You prove control of the address with\nan org-bound `personal_sign` signature over the message produced by the\nSDK helper `buildPayoutRegistrationMessage`. The org id is taken from your\nauthenticated key, never the body, so a captured signature can't register\nan address under another org. Exactly one default address exists per\n(org, network); registering again replaces it. A payee MUST register a\npayout address before calling `createChallenge`, because the challenge's\n`pay_to` is resolved from this directory.\n",
        "tags": [
          "Payments"
        ],
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RegisterPayoutAddressInput"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Payout address registered (or updated) and set as default",
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
                          "$ref": "#/components/schemas/X402PayoutAddress"
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
          "422": {
            "$ref": "#/components/responses/UnprocessableEntity"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      },
      "get": {
        "operationId": "listPayoutAddresses",
        "summary": "List payout addresses",
        "description": "List your org's registered payout addresses, newest first.",
        "tags": [
          "Payments"
        ],
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Your registered payout addresses",
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
                            "$ref": "#/components/schemas/X402PayoutAddress"
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
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      }
    },
    "/x402/email-challenges": {
      "post": {
        "operationId": "createEmailChallenge",
        "summary": "Create an email-native payment challenge",
        "description": "Issue an x402 payment challenge over a real email thread (the payee\nside). Unlike `createChallenge` (which mints a synthetic challenge id),\nthis sends the challenge as an email from `from` to `to` and binds the\npayment to that DKIM-authenticated thread. The `pay_to` address and the\ntoken asset are resolved server-side from your registered default payout\naddress for the network, never from the request. The response carries\nthe thread's `interaction_id` plus the `challenge` (the\n`payment_requirements`, the `nonce_binding`, and `expires_at`) the payer\nneeds to sign; the payer replies with a signed `payment` interaction\nstep. Amounts are in token base units (USDC has 6 decimals, so `\"10000\"`\nis 0.01 USDC).\n",
        "tags": [
          "Payments"
        ],
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/IdempotencyKey"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateEmailChallengeInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Idempotent replay: a request with a previously-used idempotency key\nreturns the original issued challenge without sending a second email.\n",
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
                          "$ref": "#/components/schemas/X402EmailChallenge"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "201": {
            "description": "Email challenge issued",
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
                          "$ref": "#/components/schemas/X402EmailChallenge"
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
          "409": {
            "$ref": "#/components/responses/Conflict"
          },
          "422": {
            "$ref": "#/components/responses/UnprocessableEntity"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      }
    },
    "/x402/challenges": {
      "post": {
        "operationId": "createChallenge",
        "summary": "Create a payment challenge",
        "description": "Create an x402 payment challenge (the payee side of a payment). The\n`pay_to` address is resolved server-side from your registered default\npayout address for the network, never from the request. The response\ncarries the `nonce_binding` and `payment_requirements` the payer needs to\nsign; hand the whole challenge object to the payer (for example in an\nemail reply). Amounts are in token base units (USDC has 6 decimals, so\n`\"10000\"` is 0.01 USDC).\n",
        "tags": [
          "Payments"
        ],
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateChallengeInput"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Challenge created",
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
                          "$ref": "#/components/schemas/X402Challenge"
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
          "422": {
            "$ref": "#/components/responses/UnprocessableEntity"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      }
    },
    "/x402/challenges/{id}": {
      "get": {
        "operationId": "getChallenge",
        "summary": "Get a payment challenge",
        "description": "Fetch a challenge you created, to poll its `status` and settlement\nreceipt (`settle_tx`). Scoped to the challenger org that created it.\n",
        "tags": [
          "Payments"
        ],
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/ResourceId"
          }
        ],
        "responses": {
          "200": {
            "description": "The challenge",
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
                          "$ref": "#/components/schemas/X402Challenge"
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
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      }
    },
    "/x402/challenges/{id}/pay": {
      "post": {
        "operationId": "payChallenge",
        "summary": "Pay a payment challenge",
        "description": "Settle a challenge addressed to your org as payer. The request body\ncarries a signed x402 `PaymentPayload`: an EIP-3009\n`transferWithAuthorization` signed locally with your own key, whose nonce\nis bound to the challenge via the SDK's `deriveEip3009Nonce`. The platform\nverifies every signed field against its own record of the challenge,\napplies your spend policy, and settles on-chain through a facilitator.\nSettlement is non-custodial; Primitive never holds funds. Idempotent:\npaying an already-settled challenge returns the original receipt. Most\ncallers use the SDK `pay()` helper rather than building the payload by\nhand.\n",
        "tags": [
          "Payments"
        ],
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/ResourceId"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/PayChallengeInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Challenge settled (or already settled)",
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
                          "$ref": "#/components/schemas/X402Receipt"
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
          "409": {
            "$ref": "#/components/responses/Conflict"
          },
          "422": {
            "$ref": "#/components/responses/UnprocessableEntity"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          },
          "502": {
            "$ref": "#/components/responses/BadGateway"
          }
        }
      }
    },
    "/x402/spend-policy": {
      "get": {
        "operationId": "getSpendPolicy",
        "summary": "Get your spend policy",
        "description": "Read your org's outbound spend policy: the kill-switch, per-payment and\nper-day caps, and the payee allowlist. Returns the defaults (no limits,\nnot paused) when no policy has been set.\n",
        "tags": [
          "Payments"
        ],
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "The spend policy",
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
                          "$ref": "#/components/schemas/X402SpendPolicy"
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
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      },
      "put": {
        "operationId": "updateSpendPolicy",
        "summary": "Update your spend policy",
        "description": "Update your org's spend policy. Applied as a merge: only the fields you\ninclude change, and omitted fields keep their current value, so a partial\nupdate can't silently reset the kill-switch. Send an explicit `null` to\nclear a cap. Caps are in token base units.\n",
        "tags": [
          "Payments"
        ],
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateSpendPolicyInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "The updated spend policy",
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
                          "$ref": "#/components/schemas/X402SpendPolicy"
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
          }
        }
      }
    },
    "/x402/declined-payments": {
      "get": {
        "operationId": "listDeclinedPayments",
        "summary": "List declined payments",
        "description": "The 50 most recent payments your org's spend policy declined, newest\nfirst. Use this to see why an outbound payment was refused (a cap, the\npayee allowlist, or the kill-switch) instead of only reading the\ndashboard.\n",
        "tags": [
          "Payments"
        ],
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Recently declined payments",
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
                            "$ref": "#/components/schemas/X402DeclinedPayment"
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
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        }
      }
    },
    "/registries": {
      "get": {
        "operationId": "listRegistries",
        "summary": "List the registries you own",
        "tags": [
          "Registries"
        ],
        "responses": {
          "200": {
            "description": "Registries owned by the caller",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "properties": {
                        "data": {
                          "type": "array",
                          "items": {
                            "$ref": "#/components/schemas/Registry"
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
        "operationId": "createRegistry",
        "summary": "Create a registry",
        "tags": [
          "Registries"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateRegistryInput"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Registry created",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "properties": {
                        "data": {
                          "type": "object",
                          "properties": {
                            "id": {
                              "type": "string",
                              "format": "uuid"
                            },
                            "slug": {
                              "type": "string"
                            }
                          },
                          "required": [
                            "id",
                            "slug"
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
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "409": {
            "$ref": "#/components/responses/Conflict"
          },
          "422": {
            "$ref": "#/components/responses/ValidationError"
          }
        }
      }
    },
    "/registries/{slug}": {
      "parameters": [
        {
          "name": "slug",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "The registry slug"
        }
      ],
      "get": {
        "operationId": "getRegistry",
        "summary": "Get a public registry's metadata",
        "tags": [
          "Registries"
        ],
        "security": [],
        "responses": {
          "200": {
            "description": "Registry metadata",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/Registry"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      },
      "patch": {
        "operationId": "updateRegistry",
        "summary": "Update a registry you own",
        "tags": [
          "Registries"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateRegistryInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Registry updated",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "properties": {
                        "data": {
                          "type": "object",
                          "properties": {
                            "id": {
                              "type": "string",
                              "format": "uuid"
                            }
                          },
                          "required": [
                            "id"
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
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "422": {
            "$ref": "#/components/responses/ValidationError"
          }
        }
      },
      "delete": {
        "operationId": "deleteRegistry",
        "summary": "Delete a registry you own",
        "description": "Removes the registry from discovery and frees its slug for re-creation.",
        "tags": [
          "Registries"
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
          }
        }
      }
    },
    "/registries/{slug}/agents": {
      "parameters": [
        {
          "name": "slug",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "The registry slug."
        }
      ],
      "get": {
        "operationId": "listRegistryAgents",
        "summary": "List agents in a registry",
        "tags": [
          "Registries"
        ],
        "security": [],
        "parameters": [
          {
            "name": "limit",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "minimum": 1,
              "maximum": 200
            },
            "description": "Maximum number of items to return (1-200)."
          },
          {
            "name": "cursor",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "The address of the last agent from the previous page."
          }
        ],
        "responses": {
          "200": {
            "description": "Approved, reachable agents. Empty for an unknown or private registry.",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/ListEnvelope"
                    },
                    {
                      "properties": {
                        "data": {
                          "type": "array",
                          "items": {
                            "$ref": "#/components/schemas/RegistryAgent"
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      },
      "post": {
        "operationId": "publishAgent",
        "summary": "Publish an agent into a registry",
        "tags": [
          "Registries"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/PublishAgentInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Idempotent replay of an existing publication",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/PublishAgentResult"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "201": {
            "description": "Published (approved) or request created (requested)",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/PublishAgentResult"
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
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          },
          "409": {
            "$ref": "#/components/responses/Conflict"
          },
          "422": {
            "$ref": "#/components/responses/ValidationError"
          }
        }
      }
    },
    "/registries/{slug}/agents/{handle}": {
      "parameters": [
        {
          "name": "slug",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "The registry slug."
        },
        {
          "name": "handle",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "The registry-scoped handle the agent is published under."
        }
      ],
      "get": {
        "operationId": "resolveRegistryHandle",
        "summary": "Resolve a registry handle to its agent",
        "tags": [
          "Registries"
        ],
        "security": [],
        "responses": {
          "200": {
            "description": "The agent listing under the handle",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/RegistryAgent"
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      },
      "delete": {
        "operationId": "unpublishAgent",
        "summary": "Unpublish an agent from a registry",
        "tags": [
          "Registries"
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
          }
        }
      }
    },
    "/registries/{slug}/requests": {
      "parameters": [
        {
          "name": "slug",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "The registry slug."
        }
      ],
      "get": {
        "operationId": "listRegistryRequests",
        "summary": "List pending publication requests",
        "tags": [
          "Registries"
        ],
        "parameters": [
          {
            "name": "limit",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "minimum": 1,
              "maximum": 200
            },
            "description": "Maximum number of items to return (1-200)."
          }
        ],
        "responses": {
          "200": {
            "description": "Pending requests for a registry you own",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "properties": {
                        "data": {
                          "type": "array",
                          "items": {
                            "$ref": "#/components/schemas/RegistryRequest"
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
          },
          "404": {
            "$ref": "#/components/responses/NotFound"
          }
        }
      }
    },
    "/registries/{slug}/requests/{id}": {
      "parameters": [
        {
          "name": "slug",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "The registry slug."
        },
        {
          "$ref": "#/components/parameters/ResourceId"
        }
      ],
      "post": {
        "operationId": "decideRegistryRequest",
        "summary": "Approve or reject a publication request",
        "tags": [
          "Registries"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/DecideRegistryRequestInput"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Decision applied",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "properties": {
                        "data": {
                          "type": "object",
                          "properties": {
                            "status": {
                              "type": "string",
                              "enum": [
                                "approved",
                                "rejected"
                              ]
                            }
                          },
                          "required": [
                            "status"
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
          },
          "409": {
            "$ref": "#/components/responses/Conflict"
          },
          "422": {
            "$ref": "#/components/responses/ValidationError"
          }
        }
      }
    },
    "/agents": {
      "post": {
        "operationId": "defineAgent",
        "summary": "Define an agent identity",
        "tags": [
          "Registries"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/DefineAgentInput"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Agent defined",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "properties": {
                        "data": {
                          "type": "object",
                          "properties": {
                            "id": {
                              "type": "string",
                              "format": "uuid"
                            },
                            "address": {
                              "type": "string"
                            }
                          },
                          "required": [
                            "id",
                            "address"
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
          "409": {
            "$ref": "#/components/responses/Conflict"
          },
          "422": {
            "$ref": "#/components/responses/ValidationError"
          }
        }
      }
    },
    "/agents/{address}": {
      "parameters": [
        {
          "name": "address",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          },
          "description": "The agent's email address (URL-encoded)."
        }
      ],
      "get": {
        "operationId": "getAgent",
        "summary": "Get an agent's public profile by address",
        "tags": [
          "Registries"
        ],
        "security": [],
        "responses": {
          "200": {
            "description": "The agent's public profile",
            "content": {
              "application/json": {
                "schema": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/SuccessEnvelope"
                    },
                    {
                      "properties": {
                        "data": {
                          "$ref": "#/components/schemas/RegistryAgent"
                        }
                      }
                    }
                  ]
                }
              }
            }
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
      "IdempotencyKey": {
        "name": "idempotency-key",
        "in": "header",
        "required": false,
        "schema": {
          "type": "string",
          "maxLength": 255
        },
        "description": "Optional idempotency key. Retrying a request with the same key returns\nthe original result instead of repeating the side effect (for\n`createEmailChallenge`, re-sending the email).\n"
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
      },
      "MemoryKeyQuery": {
        "name": "key",
        "in": "query",
        "required": true,
        "description": "Memory key. Must be at most 512 UTF-8 bytes.",
        "schema": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        }
      },
      "MemoryScopeQueryType": {
        "name": "scope_type",
        "in": "query",
        "required": false,
        "description": "Explicit scope type. Omit to use automatic scope resolution. Pass\n`function` with `scope_id=<function-id>`, or `org` with no `scope_id`.\n",
        "schema": {
          "type": "string",
          "enum": [
            "org",
            "function"
          ]
        }
      },
      "MemoryScopeId": {
        "name": "scope_id",
        "in": "query",
        "required": false,
        "description": "Function id UUID when `scope_type=function`. Not valid with\n`scope_type=org`.\n",
        "schema": {
          "type": "string",
          "format": "uuid"
        }
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
      "PaymentRequired": {
        "description": "Usage credits are exhausted or payment is required",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            },
            "example": {
              "success": false,
              "error": {
                "code": "developer_usage_credit_exhausted",
                "message": "Usage credits exhausted for memory.write"
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
      "Conflict": {
        "description": "The request conflicts with the current state of the resource",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            },
            "example": {
              "success": false,
              "error": {
                "code": "conflict",
                "message": "settlement already in progress"
              }
            }
          }
        }
      },
      "UnprocessableEntity": {
        "description": "The request was well-formed but could not be processed. For Payments\nthis covers a missing payout address, a failed payment verification, a\nspend-policy decline, or an expired challenge; `error.code` distinguishes\nthem.\n",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ErrorResponse"
            },
            "example": {
              "success": false,
              "error": {
                "code": "payment_declined",
                "message": "payment exceeds the per-payment cap"
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
      "PublishPolicy": {
        "type": "string",
        "enum": [
          "owner_only",
          "request",
          "open"
        ],
        "description": "Who may publish into a registry. owner_only: only the registry owner.\nrequest: anyone may request and the owner approves. open: anyone may\npublish and it lists immediately (no approval step).\n"
      },
      "Registry": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "slug": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "description": {
            "type": [
              "string",
              "null"
            ]
          },
          "is_public": {
            "type": "boolean"
          },
          "publish_policy": {
            "$ref": "#/components/schemas/PublishPolicy"
          }
        },
        "required": [
          "id",
          "slug",
          "name",
          "description",
          "is_public",
          "publish_policy"
        ]
      },
      "RegistryAgent": {
        "type": "object",
        "description": "An agent's public directory profile.",
        "properties": {
          "address": {
            "type": "string"
          },
          "display_name": {
            "type": "string"
          },
          "title": {
            "type": [
              "string",
              "null"
            ]
          },
          "description": {
            "type": [
              "string",
              "null"
            ]
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "handle": {
            "type": [
              "string",
              "null"
            ],
            "description": "The registry-scoped name. Null on the global by-address read."
          },
          "last_reachable_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time",
            "description": "When the agent's address was last confirmed to still route to its endpoint. A freshness signal for ranking listings; null until the first check."
          }
        },
        "required": [
          "address",
          "display_name",
          "title",
          "description",
          "tags",
          "handle",
          "last_reachable_at"
        ]
      },
      "RegistryRequest": {
        "type": "object",
        "description": "A pending publication request, as the registry owner sees it.",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "address": {
            "type": "string"
          },
          "display_name": {
            "type": "string"
          },
          "handle": {
            "type": [
              "string",
              "null"
            ]
          },
          "requested_at": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "id",
          "address",
          "display_name",
          "handle",
          "requested_at"
        ]
      },
      "CreateRegistryInput": {
        "type": "object",
        "properties": {
          "slug": {
            "type": "string",
            "pattern": "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$",
            "description": "Lowercase slug, unique across registries."
          },
          "name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 120
          },
          "description": {
            "type": [
              "string",
              "null"
            ],
            "maxLength": 2000
          },
          "is_public": {
            "type": "boolean"
          },
          "publish_policy": {
            "$ref": "#/components/schemas/PublishPolicy"
          }
        },
        "required": [
          "slug",
          "name"
        ]
      },
      "UpdateRegistryInput": {
        "type": "object",
        "minProperties": 1,
        "properties": {
          "name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 120
          },
          "description": {
            "type": [
              "string",
              "null"
            ],
            "maxLength": 2000
          },
          "is_public": {
            "type": "boolean"
          },
          "publish_policy": {
            "$ref": "#/components/schemas/PublishPolicy"
          }
        }
      },
      "DefineAgentInput": {
        "type": "object",
        "properties": {
          "address": {
            "type": "string",
            "description": "The agent's globally unique email address; mail to it must route to an endpoint the account controls."
          },
          "endpoint_id": {
            "type": "string",
            "format": "uuid",
            "description": "Optional. The endpoint the agent runs on. Omit it to resolve the endpoint from the address's routing automatically; supply it to pin a specific endpoint, which is then validated against the address's route."
          },
          "display_name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 120
          },
          "title": {
            "type": [
              "string",
              "null"
            ],
            "maxLength": 120
          },
          "description": {
            "type": [
              "string",
              "null"
            ],
            "maxLength": 2000
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 40
            },
            "maxItems": 20
          }
        },
        "required": [
          "address",
          "display_name"
        ]
      },
      "PublishAgentInput": {
        "type": "object",
        "description": "Publish an agent into a registry. When display_name is present the agent identity is defined (create-or-get by address) in the same call before publishing; omit the define fields to publish an already-defined agent.",
        "properties": {
          "address": {
            "type": "string"
          },
          "handle": {
            "type": "string",
            "description": "The registry-scoped name to list the agent under."
          },
          "display_name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 120,
            "description": "Present to define the agent identity before publishing (define + publish in one call)."
          },
          "endpoint_id": {
            "type": "string",
            "format": "uuid",
            "description": "Optional, only used when defining. Omit to resolve the endpoint from the address's routing."
          },
          "title": {
            "type": [
              "string",
              "null"
            ],
            "maxLength": 120
          },
          "description": {
            "type": [
              "string",
              "null"
            ],
            "maxLength": 2000
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 40
            },
            "maxItems": 20
          }
        },
        "required": [
          "address",
          "handle"
        ],
        "dependentRequired": {
          "endpoint_id": [
            "display_name"
          ],
          "title": [
            "display_name"
          ],
          "description": [
            "display_name"
          ],
          "tags": [
            "display_name"
          ]
        }
      },
      "PublishAgentResult": {
        "type": "object",
        "properties": {
          "status": {
            "type": "string",
            "enum": [
              "approved",
              "requested"
            ],
            "description": "approved lists immediately; requested pends owner approval."
          },
          "handle": {
            "type": "string"
          },
          "idempotent_replay": {
            "type": "boolean",
            "description": "True when the publish matched an existing identical publication."
          }
        },
        "required": [
          "status",
          "handle",
          "idempotent_replay"
        ]
      },
      "DecideRegistryRequestInput": {
        "type": "object",
        "properties": {
          "decision": {
            "type": "string",
            "enum": [
              "approved",
              "rejected"
            ]
          }
        },
        "required": [
          "decision"
        ]
      },
      "RegisterPayoutAddressInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "address": {
            "type": "string",
            "pattern": "^0x[0-9a-fA-F]{40}$",
            "description": "The payout address (your signer's own EVM address), 0x-prefixed."
          },
          "network": {
            "type": "string",
            "enum": [
              "base",
              "base-sepolia"
            ],
            "description": "The chain the address receives on."
          },
          "signature": {
            "type": "string",
            "pattern": "^0x[0-9a-fA-F]+$",
            "description": "A `personal_sign` signature over the org-bound message produced by\nthe SDK helper `buildPayoutRegistrationMessage`. Recovered and\nchecked against `address`; the org id is bound into the signed bytes.\n"
          },
          "issued_at": {
            "type": "string",
            "format": "date-time",
            "description": "ISO-8601 timestamp embedded in the signed message. Must be within a\nshort freshness window (about 10 minutes) of server time.\n"
          },
          "label": {
            "type": "string",
            "maxLength": 80,
            "description": "Optional human-readable label."
          }
        },
        "required": [
          "address",
          "network",
          "signature",
          "issued_at"
        ]
      },
      "X402PayoutAddress": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "address": {
            "type": "string",
            "description": "The checksummed payout address."
          },
          "network": {
            "type": "string",
            "enum": [
              "base",
              "base-sepolia"
            ]
          },
          "label": {
            "type": [
              "string",
              "null"
            ]
          },
          "is_default": {
            "type": "boolean",
            "description": "Exactly one address per (org, network) is the default."
          },
          "verified_at": {
            "type": "string",
            "format": "date-time",
            "description": "When ownership of the address was last proven."
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "id",
          "address",
          "network",
          "label",
          "is_default",
          "verified_at"
        ]
      },
      "CreateChallengeInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "amount": {
            "type": "string",
            "pattern": "^[1-9][0-9]{0,38}$",
            "description": "Amount to collect, in token base units. USDC has 6 decimals, so\n`\"10000\"` is 0.01 USDC.\n"
          },
          "network": {
            "type": "string",
            "enum": [
              "base",
              "base-sepolia"
            ]
          },
          "payer_org": {
            "type": "string",
            "format": "uuid",
            "description": "The org id allowed to pay this challenge (on-net binding). Optional.\n"
          },
          "expires_in": {
            "type": "integer",
            "minimum": 60,
            "maximum": 86400,
            "description": "Seconds until the challenge expires. Defaults to 3600."
          },
          "resource": {
            "type": "string",
            "format": "uri",
            "maxLength": 2048,
            "description": "Optional URL identifying what is being paid for. Defaults to a\nsynthetic `x402:challenge:<id>` identifier.\n"
          },
          "description": {
            "type": "string",
            "maxLength": 512,
            "description": "Optional human-readable description of the payment."
          }
        },
        "required": [
          "amount",
          "network"
        ]
      },
      "X402NonceBinding": {
        "type": "object",
        "description": "The interaction binding the payer hashes into the EIP-3009 nonce\n(`deriveEip3009Nonce`). Pinning the nonce to this binding is what lets an\nx402 payment ride asynchronous transports safely: a replayed challenge\ncan't redirect funds and a signed payment can't settle twice.\n",
        "properties": {
          "interaction_id": {
            "type": "string",
            "description": "Interaction id, including its `@domain` part."
          },
          "challenge_step_id": {
            "type": "string",
            "format": "uuid"
          },
          "challenge_nonce": {
            "type": "string",
            "pattern": "^[0-9a-f]{64}$",
            "description": "32 random bytes as 64 lowercase hex chars."
          }
        },
        "required": [
          "interaction_id",
          "challenge_step_id",
          "challenge_nonce"
        ]
      },
      "X402PaymentRequirements": {
        "type": "object",
        "description": "The x402 `PaymentRequirements` the payer signs over. Field names are\nx402's native camelCase, preserved byte-for-byte.\n",
        "properties": {
          "scheme": {
            "type": "string",
            "description": "The x402 settlement scheme. Always `exact` for v1.",
            "example": "exact"
          },
          "network": {
            "type": "string",
            "enum": [
              "base",
              "base-sepolia"
            ]
          },
          "maxAmountRequired": {
            "type": "string",
            "description": "Amount in token base units."
          },
          "payTo": {
            "type": "string",
            "description": "The payee's resolved payout address (checksummed)."
          },
          "asset": {
            "type": "string",
            "description": "The token contract address (checksummed). USDC."
          },
          "resource": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "maxTimeoutSeconds": {
            "type": "integer"
          },
          "extra": {
            "type": "object",
            "description": "The token's load-bearing EIP-712 domain params. `name` differs by\nchain (Base mainnet USDC is `USD Coin`, Base Sepolia is `USDC`); a\nwrong value produces a signature the verifier rejects.\n",
            "properties": {
              "name": {
                "type": "string"
              },
              "version": {
                "type": "string"
              }
            },
            "required": [
              "name",
              "version"
            ]
          }
        },
        "required": [
          "scheme",
          "network",
          "maxAmountRequired",
          "payTo",
          "asset",
          "extra"
        ]
      },
      "X402Challenge": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "status": {
            "type": "string",
            "enum": [
              "pending",
              "settling",
              "settled",
              "failed",
              "expired"
            ]
          },
          "network": {
            "type": "string",
            "enum": [
              "base",
              "base-sepolia"
            ]
          },
          "asset": {
            "type": "string",
            "description": "Token contract address (checksummed)."
          },
          "amount": {
            "type": "string",
            "description": "Amount in token base units."
          },
          "pay_to": {
            "type": "string",
            "description": "The payee's resolved payout address (checksummed)."
          },
          "payer_org": {
            "type": [
              "string",
              "null"
            ],
            "description": "The org id bound as payer, if one was set at creation."
          },
          "resource": {
            "type": [
              "string",
              "null"
            ]
          },
          "description": {
            "type": [
              "string",
              "null"
            ]
          },
          "nonce_binding": {
            "$ref": "#/components/schemas/X402NonceBinding"
          },
          "settle_tx": {
            "type": [
              "string",
              "null"
            ],
            "description": "On-chain settlement transaction hash once settled."
          },
          "settled_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "failure_reason": {
            "type": [
              "string",
              "null"
            ]
          },
          "expires_at": {
            "type": "string",
            "format": "date-time"
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          },
          "payment_requirements": {
            "description": "Present on the create response. Hand the whole challenge (including\nthis) to the payer; `getChallenge` omits it (it is for status polling\nby the challenger).\n",
            "allOf": [
              {
                "$ref": "#/components/schemas/X402PaymentRequirements"
              }
            ]
          }
        },
        "required": [
          "id",
          "status",
          "network",
          "asset",
          "amount",
          "pay_to",
          "nonce_binding",
          "expires_at"
        ]
      },
      "CreateEmailChallengeInput": {
        "type": "object",
        "additionalProperties": false,
        "description": "Issue a payment challenge over an email thread. `from` is your sending\naddress (the funds receiver; ownership is enforced at send, exactly as\nfor outbound mail) and `to` is the payer's address. The `pay_to` payout\nwallet and the token asset are resolved server-side, never taken from\nthe request.\n",
        "properties": {
          "from": {
            "type": "string",
            "format": "email",
            "description": "Your sending address (the payee / funds receiver). Must be an\naddress your org is allowed to send from.\n"
          },
          "to": {
            "type": "string",
            "format": "email",
            "description": "The payer's email address the challenge is sent to."
          },
          "amount": {
            "type": "string",
            "pattern": "^[1-9][0-9]{0,38}$",
            "description": "Amount to collect, in token base units (unlike the `charge` CLI\ncommand, which also accepts `--amount-usdc`, this field takes base\nunits only). USDC has 6 decimals, so `\"10000\"` is 0.01 USDC:\nmultiply a human USDC amount by 1,000,000 (0.01 USDC -> `\"10000\"`).\n"
          },
          "network": {
            "type": "string",
            "enum": [
              "base",
              "base-sepolia"
            ]
          },
          "expires_in": {
            "type": "integer",
            "minimum": 60,
            "maximum": 86400,
            "description": "Seconds until the challenge expires. Defaults to 300."
          },
          "resource": {
            "type": "string",
            "format": "uri",
            "maxLength": 2048,
            "description": "Optional URL identifying what is being paid for."
          },
          "description": {
            "type": "string",
            "maxLength": 512,
            "description": "Optional human-readable description of the payment."
          }
        },
        "required": [
          "from",
          "to",
          "amount",
          "network"
        ]
      },
      "X402EmailChallengeDetails": {
        "type": "object",
        "description": "The challenge the payer needs to sign and pay, carried inside an\nemail-native challenge response.\n",
        "properties": {
          "payment_requirements": {
            "$ref": "#/components/schemas/X402PaymentRequirements"
          },
          "nonce_binding": {
            "$ref": "#/components/schemas/X402NonceBinding"
          },
          "expires_at": {
            "type": "string",
            "format": "date-time",
            "description": "ISO-8601 expiry of the challenge."
          }
        },
        "required": [
          "payment_requirements",
          "nonce_binding",
          "expires_at"
        ]
      },
      "X402EmailChallenge": {
        "type": "object",
        "description": "The result of issuing an email-native payment challenge. `interaction_id`\nis the real email thread id (`uuid@domain`) the payment is bound to;\n`challenge_id` is the underlying challenge record. Hand the `challenge`\nto the payer, who replies with a signed `payment` interaction step (the\nSDK `payEmailChallenge` helper builds it).\n",
        "properties": {
          "interaction_id": {
            "type": "string",
            "description": "The email thread id (`uuid@domain`) the payment is bound to."
          },
          "challenge_id": {
            "type": "string",
            "format": "uuid",
            "description": "The underlying challenge record id."
          },
          "challenge": {
            "$ref": "#/components/schemas/X402EmailChallengeDetails"
          }
        },
        "required": [
          "interaction_id",
          "challenge_id",
          "challenge"
        ]
      },
      "X402PaymentPayload": {
        "type": "object",
        "description": "A signed x402 v1 `PaymentPayload`. The SDK `pay()` helper builds this;\ncallers rarely construct it by hand. Field names are x402-native.\n",
        "properties": {
          "x402Version": {
            "type": "integer",
            "const": 1
          },
          "scheme": {
            "type": "string",
            "const": "exact"
          },
          "network": {
            "type": "string",
            "enum": [
              "base",
              "base-sepolia"
            ]
          },
          "payload": {
            "type": "object",
            "properties": {
              "signature": {
                "type": "string",
                "pattern": "^0x[0-9a-fA-F]+$",
                "description": "The EIP-712 signature over the authorization."
              },
              "authorization": {
                "type": "object",
                "description": "The EIP-3009 `transferWithAuthorization` fields, as strings.",
                "properties": {
                  "from": {
                    "type": "string"
                  },
                  "to": {
                    "type": "string"
                  },
                  "value": {
                    "type": "string"
                  },
                  "validAfter": {
                    "type": "string"
                  },
                  "validBefore": {
                    "type": "string"
                  },
                  "nonce": {
                    "type": "string"
                  }
                },
                "required": [
                  "from",
                  "to",
                  "value",
                  "validAfter",
                  "validBefore",
                  "nonce"
                ]
              }
            },
            "required": [
              "signature",
              "authorization"
            ]
          }
        },
        "required": [
          "x402Version",
          "scheme",
          "network",
          "payload"
        ]
      },
      "PayChallengeInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "payment": {
            "$ref": "#/components/schemas/X402PaymentPayload"
          }
        },
        "required": [
          "payment"
        ]
      },
      "X402Receipt": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "status": {
            "type": "string",
            "enum": [
              "settled"
            ]
          },
          "settle_tx": {
            "type": [
              "string",
              "null"
            ],
            "description": "On-chain settlement transaction hash."
          }
        },
        "required": [
          "id",
          "status",
          "settle_tx"
        ]
      },
      "X402SpendPolicy": {
        "type": "object",
        "description": "The payer's outbound spend policy. Returned with defaults (not paused,\nno caps, any on-net payee) when none is set.\n",
        "properties": {
          "paused": {
            "type": "boolean",
            "description": "Kill-switch. When true, all outbound payments are refused."
          },
          "max_per_payment": {
            "type": [
              "string",
              "null"
            ],
            "description": "Per-payment cap in token base units, or null for no cap."
          },
          "max_per_day": {
            "type": [
              "string",
              "null"
            ],
            "description": "Rolling-day cap in token base units, or null for no cap."
          },
          "allowlist": {
            "type": [
              "array",
              "null"
            ],
            "items": {
              "type": "string",
              "format": "uuid"
            },
            "description": "Allowed payee org ids. `null` allows any on-net payee; `[]` denies\nall.\n"
          }
        },
        "required": [
          "paused",
          "max_per_payment",
          "max_per_day",
          "allowlist"
        ]
      },
      "UpdateSpendPolicyInput": {
        "type": "object",
        "additionalProperties": false,
        "description": "Merge update: only the fields you include change; omit a field to keep\nits current value; send `null` to clear a cap.\n",
        "properties": {
          "paused": {
            "type": "boolean"
          },
          "max_per_payment": {
            "type": [
              "string",
              "null"
            ],
            "pattern": "^[1-9][0-9]{0,38}$"
          },
          "max_per_day": {
            "type": [
              "string",
              "null"
            ],
            "pattern": "^[1-9][0-9]{0,38}$"
          },
          "allowlist": {
            "type": [
              "array",
              "null"
            ],
            "maxItems": 1000,
            "items": {
              "type": "string",
              "format": "uuid"
            }
          }
        }
      },
      "X402DeclinedPayment": {
        "type": "object",
        "description": "A payment the org's spend policy refused.",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "challenge_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid",
            "description": "The challenge that was declined, if still present."
          },
          "counterparty_org": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid",
            "description": "The payee (challenger) org, when known."
          },
          "network": {
            "type": "string",
            "enum": [
              "base",
              "base-sepolia"
            ]
          },
          "amount": {
            "type": "string",
            "description": "Amount in token base units."
          },
          "reason": {
            "type": "string",
            "description": "Why the payment was declined (cap, allowlist, paused)."
          },
          "declined_at": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "id",
          "network",
          "amount",
          "reason",
          "declined_at"
        ]
      },
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
                  "org_not_accessible",
                  "feature_disabled",
                  "memory_conflict",
                  "template_not_installable",
                  "scaffold_only",
                  "invalid_variables",
                  "unknown_secrets",
                  "missing_secrets",
                  "no_inbound_domain",
                  "domain_cannot_send",
                  "address_taken",
                  "route_cap_reached",
                  "name_exhausted",
                  "developer_usage_credit_exhausted",
                  "no_payout_address",
                  "ownership_proof_failed",
                  "payment_verification_failed",
                  "payment_declined",
                  "challenge_expired",
                  "settlement_failed"
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
            "maxLength": 128,
            "description": "Optional signup code. Omit if you do not have one."
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
            "maxLength": 128,
            "description": "Optional signup code. Omit if you do not have one."
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
      "PlanLimits": {
        "type": "object",
        "description": "Plan-derived quota limits for an account.",
        "properties": {
          "storage_mb": {
            "type": "number"
          },
          "send_per_hour": {
            "type": "number"
          },
          "send_per_day": {
            "type": "number"
          },
          "api_per_minute": {
            "type": "number"
          },
          "webhooks_max_global": {
            "type": [
              "number",
              "null"
            ]
          },
          "webhooks_per_domain": {
            "type": "boolean"
          },
          "filters_per_domain": {
            "type": "boolean"
          },
          "spam_thresholds_per_domain": {
            "type": "boolean"
          }
        },
        "required": [
          "storage_mb",
          "send_per_hour",
          "send_per_day",
          "api_per_minute",
          "webhooks_max_global",
          "webhooks_per_domain",
          "filters_per_domain",
          "spam_thresholds_per_domain"
        ]
      },
      "CreateAgentAccountInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "terms_accepted": {
            "type": "boolean",
            "enum": [
              true
            ],
            "description": "Must be true to accept the Terms of Service and Privacy Policy."
          },
          "device_name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 80,
            "description": "Optional label for the device or agent creating the account."
          }
        },
        "required": [
          "terms_accepted"
        ]
      },
      "AgentAccountUpgradeHint": {
        "type": "object",
        "description": "In-band pointer to the upgrade path for an agent account.",
        "properties": {
          "plan": {
            "type": "string",
            "enum": [
              "developer"
            ]
          },
          "description": {
            "type": "string"
          },
          "claim_path": {
            "type": "string"
          }
        },
        "required": [
          "plan",
          "description",
          "claim_path"
        ]
      },
      "AgentAccountResult": {
        "type": "object",
        "properties": {
          "api_key": {
            "type": "string",
            "description": "One-time API key (prefixed `prim_`). Shown once; store it securely."
          },
          "org_id": {
            "type": "string",
            "format": "uuid"
          },
          "address": {
            "type": [
              "string",
              "null"
            ],
            "description": "Provisioned managed inbox FQDN, or null if the inbox publish was deferred."
          },
          "plan": {
            "type": "string",
            "enum": [
              "agent"
            ]
          },
          "limits": {
            "$ref": "#/components/schemas/PlanLimits"
          },
          "upgrade": {
            "$ref": "#/components/schemas/AgentAccountUpgradeHint"
          }
        },
        "required": [
          "api_key",
          "org_id",
          "address",
          "plan",
          "limits",
          "upgrade"
        ]
      },
      "StartAgentClaimInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "email": {
            "type": "string",
            "format": "email",
            "maxLength": 254,
            "description": "Email to confirm. Must not already belong to a Primitive account."
          }
        },
        "required": [
          "email"
        ]
      },
      "AgentClaimStartResult": {
        "type": "object",
        "properties": {
          "claim_session_id": {
            "type": "string"
          },
          "resend_after_seconds": {
            "type": "integer"
          },
          "expires_in_seconds": {
            "type": "integer"
          }
        },
        "required": [
          "claim_session_id",
          "resend_after_seconds",
          "expires_in_seconds"
        ]
      },
      "VerifyAgentClaimInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "verification_code": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32,
            "description": "The verification code emailed by the claim start step."
          }
        },
        "required": [
          "verification_code"
        ]
      },
      "AgentClaimResult": {
        "type": "object",
        "properties": {
          "org_id": {
            "type": "string",
            "format": "uuid"
          },
          "plan": {
            "type": "string",
            "enum": [
              "developer"
            ]
          },
          "email": {
            "type": "string",
            "format": "email"
          },
          "limits": {
            "$ref": "#/components/schemas/PlanLimits"
          }
        },
        "required": [
          "org_id",
          "plan",
          "email",
          "limits"
        ]
      },
      "CreateAgentClaimLinkInput": {
        "type": "object",
        "additionalProperties": false,
        "description": "No fields; an empty object is accepted.",
        "properties": {}
      },
      "AgentClaimLinkResult": {
        "type": "object",
        "properties": {
          "claim_token": {
            "type": "string"
          },
          "claim_url": {
            "type": [
              "string",
              "null"
            ],
            "description": "Browser URL to hand to a human, or null if no web origin is configured."
          },
          "expires_in_seconds": {
            "type": "integer"
          }
        },
        "required": [
          "claim_token",
          "claim_url",
          "expires_in_seconds"
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
          "limits": {
            "$ref": "#/components/schemas/PlanLimits"
          },
          "entitlements": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Granted org entitlement keys (sorted). A headless caller reads its\ncapabilities here — e.g. an emailless agent seeing only\n[\"send_mail\", \"send_to_known_addresses\"] knows it is reply-only.\n"
          },
          "managed_inbox_address": {
            "type": [
              "string",
              "null"
            ],
            "description": "The managed inbox FQDN to reply as, or null if the org has no managed inbox."
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
          "limits",
          "entitlements",
          "managed_inbox_address",
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
      "SendMailPayloadRef": {
        "type": "object",
        "additionalProperties": false,
        "description": "A reference to an already-uploaded Primitive Payloads object, delivered as an attachment without inlining the bytes — the way to send an attachment larger than the inline cap. Upload the object via /v1/payloads (with a client-held CEK the server never sees), then reference it here.",
        "properties": {
          "root": {
            "type": "string",
            "pattern": "^[0-9a-f]{64}$",
            "description": "The 64-char lowercase-hex Merkle root of a finalized payloads object."
          },
          "filename": {
            "type": "string",
            "minLength": 1,
            "maxLength": 255,
            "description": "Attachment filename presented to the recipient."
          },
          "content_type": {
            "type": "string",
            "minLength": 1,
            "maxLength": 255,
            "description": "Optional MIME content type."
          },
          "cek": {
            "type": "string",
            "pattern": "^[A-Za-z0-9_-]{1,128}$",
            "description": "Base64url-encoded (unpadded) content-encryption key the recipient uses to decrypt. Travels with the email; the object store only ever holds ciphertext."
          }
        },
        "required": [
          "root",
          "filename",
          "cek"
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
          "cc": {
            "description": "Carbon-copy recipients. Either a single address or an array of addresses. Each entry must be a single address; use the array form for multiple recipients. Cc recipients are visible to everyone who receives the message. The combined number of to, cc, and bcc recipients must not exceed 100.",
            "oneOf": [
              {
                "type": "string",
                "minLength": 1
              },
              {
                "type": "array",
                "minItems": 1,
                "maxItems": 100,
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              }
            ]
          },
          "bcc": {
            "description": "Blind-carbon-copy recipients. Either a single address or an array of addresses. Each entry must be a single address; use the array form for multiple recipients. Bcc recipients receive the message but are not disclosed to the other recipients: no Bcc header is sent. The combined number of to, cc, and bcc recipients must not exceed 100.",
            "oneOf": [
              {
                "type": "string",
                "minLength": 1
              },
              {
                "type": "array",
                "minItems": 1,
                "maxItems": 100,
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              }
            ]
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
          "payload_attachments": {
            "type": "array",
            "maxItems": 1,
            "description": "Deliver an already-uploaded Primitive Payloads object as an attachment by reference, without inlining the bytes — the way to send attachments larger than the inline cap. Upload the object via /v1/payloads (client-held CEK), then reference it here. v1 supports at most one.",
            "items": {
              "$ref": "#/components/schemas/SendMailPayloadRef"
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
      "ReplyEmail": {
        "type": "object",
        "description": "A threaded inbound reply to one of the org's sends, keyed by\nthe inbound email's `reply_to_sent_email_id`. Compact on\npurpose: enough to read the reply and decide what to do\nnext, with `/emails/{id}` available for the fully parsed\ndetail.\n",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid",
            "description": "Inbound email row id; usable with `/emails/{id}`."
          },
          "thread_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid",
            "description": "Conversation thread id; usable with `/threads/{id}`."
          },
          "reply_to_sent_email_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid",
            "description": "The sent-email id this inbound message replied to."
          },
          "from_email": {
            "type": "string",
            "description": "Sender of the reply (From header when present, else envelope sender)."
          },
          "to_email": {
            "type": "string",
            "description": "Recipient address the reply arrived at."
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
            "description": "Plain-text body of the reply, when present."
          },
          "body_html": {
            "type": [
              "string",
              "null"
            ],
            "description": "HTML body of the reply, when present."
          },
          "received_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "status": {
            "type": "string",
            "description": "Inbound processing status of the reply row. Typically an\n`EmailStatus` value, but left as an open string here to\nmatch the server contract, which does not narrow it.\n"
          }
        },
        "required": [
          "id",
          "thread_id",
          "reply_to_sent_email_id",
          "from_email",
          "to_email",
          "subject",
          "body_text",
          "body_html",
          "received_at",
          "status"
        ]
      },
      "AwaitReplyResult": {
        "type": "object",
        "description": "Result of `/sent-emails/{id}/reply`. `reply` is null when no\nreply has arrived yet (no-wait call, or the wait timed out).\n",
        "properties": {
          "sent_email_id": {
            "type": "string",
            "format": "uuid",
            "description": "The send this lookup was keyed on (echoes the path id)."
          },
          "reply": {
            "oneOf": [
              {
                "$ref": "#/components/schemas/ReplyEmail"
              },
              {
                "type": "null"
              }
            ]
          },
          "waited": {
            "type": "boolean",
            "description": "Whether the call ran in long-poll mode (`wait=true`)."
          },
          "timed_out": {
            "type": "boolean",
            "description": "True only when a `wait=true` call elapsed its timeout with no reply."
          }
        },
        "required": [
          "sent_email_id",
          "reply",
          "waited",
          "timed_out"
        ],
        "additionalProperties": false
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
          },
          "kind": {
            "type": "string",
            "enum": [
              "http",
              "function"
            ],
            "description": "http: deliver to the webhook URL. function: invoke a Primitive Function."
          },
          "function_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid",
            "description": "The Function this endpoint invokes, when kind is function."
          },
          "is_route_target": {
            "type": "boolean",
            "description": "When true, this endpoint is reachable only via an explicit recipient\nroute, never as a domain's default destination, and is exempt from\nthe one-endpoint-per-domain rule (so many can share a domain).\n"
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
          "kind": {
            "type": "string",
            "enum": [
              "http",
              "function"
            ],
            "default": "http",
            "description": "http: deliver to a webhook URL (provide url). function: invoke a Primitive Function (provide function_id, omit url)."
          },
          "url": {
            "type": "string",
            "minLength": 1,
            "description": "The webhook URL to deliver events to. Required when kind is http; omit for function endpoints."
          },
          "function_id": {
            "type": "string",
            "format": "uuid",
            "description": "The Function to invoke. Required when kind is function."
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
          },
          "is_route_target": {
            "type": "boolean",
            "default": false,
            "description": "Create this endpoint as a route-target: reachable only via an\nexplicit recipient route, never a domain's default destination, and\nexempt from the one-endpoint-per-domain rule.\n"
          }
        }
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
      "WakeSchedule": {
        "type": "object",
        "description": "A cron schedule that sends a wake.dispatch command to a function.",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "from_address": {
            "type": [
              "string",
              "null"
            ],
            "description": "The sending identity the wake is signed as."
          },
          "target_address": {
            "type": "string",
            "description": "The function address the wake is delivered to."
          },
          "command": {
            "type": "string"
          },
          "args": {
            "type": "object",
            "additionalProperties": true
          },
          "cron_expr": {
            "type": "string",
            "description": "5-field cron expression."
          },
          "timezone": {
            "type": "string",
            "description": "IANA timezone the cron is evaluated in."
          },
          "next_run_at": {
            "type": "string",
            "format": "date-time"
          },
          "last_run_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "enabled": {
            "type": "boolean"
          },
          "note": {
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
          "target_address",
          "command",
          "cron_expr",
          "timezone",
          "next_run_at",
          "enabled",
          "created_at",
          "updated_at"
        ]
      },
      "CreateWakeScheduleInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "from_address": {
            "type": "string",
            "description": "Sending identity (must be a domain the org can sign)."
          },
          "target_address": {
            "type": "string",
            "description": "Your function address (must differ from from_address)."
          },
          "command": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          },
          "args": {
            "type": "object",
            "additionalProperties": true,
            "description": "Optional JSON object passed through to the woken function."
          },
          "cron_expr": {
            "type": "string",
            "minLength": 1,
            "maxLength": 120
          },
          "timezone": {
            "type": "string",
            "minLength": 1,
            "maxLength": 64,
            "default": "UTC"
          },
          "note": {
            "type": "string",
            "maxLength": 2000
          }
        },
        "required": [
          "from_address",
          "target_address",
          "command",
          "cron_expr"
        ]
      },
      "UpdateWakeScheduleInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "enabled": {
            "type": "boolean"
          },
          "command": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          },
          "args": {
            "type": "object",
            "additionalProperties": true
          },
          "cron_expr": {
            "type": "string",
            "minLength": 1,
            "maxLength": 120
          },
          "timezone": {
            "type": "string",
            "minLength": 1,
            "maxLength": 64
          },
          "from_address": {
            "type": "string"
          },
          "target_address": {
            "type": "string"
          },
          "note": {
            "type": [
              "string",
              "null"
            ],
            "maxLength": 2000
          }
        }
      },
      "WakeAuthorization": {
        "type": "object",
        "description": "A per-target allowlist grant authorizing a sender to wake a function.",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "recipient_endpoint_id": {
            "type": "string",
            "format": "uuid"
          },
          "allowed_sender_domain": {
            "type": "string"
          },
          "allowed_sender_address": {
            "type": [
              "string",
              "null"
            ]
          },
          "allowed_commands": {
            "type": [
              "array",
              "null"
            ],
            "items": {
              "type": "string"
            }
          },
          "enabled": {
            "type": "boolean"
          },
          "note": {
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
          "recipient_endpoint_id",
          "allowed_sender_domain",
          "enabled",
          "created_at"
        ]
      },
      "CreateWakeAuthorizationInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "recipient_endpoint_id": {
            "type": "string",
            "format": "uuid"
          },
          "allowed_sender_domain": {
            "type": "string",
            "minLength": 1,
            "maxLength": 253,
            "description": "Fully-qualified sender domain (at least two labels)."
          },
          "allowed_sender_address": {
            "type": [
              "string",
              "null"
            ],
            "description": "Optional specific sender address to pin the grant to."
          },
          "allowed_commands": {
            "type": [
              "array",
              "null"
            ],
            "maxItems": 64,
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 200
            },
            "description": "Optional command allowlist; null = any command."
          },
          "note": {
            "type": "string",
            "maxLength": 2000
          }
        },
        "required": [
          "recipient_endpoint_id",
          "allowed_sender_domain"
        ]
      },
      "UpdateWakeAuthorizationInput": {
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
      "WakeDispatch": {
        "type": "object",
        "description": "A recorded wake.dispatch interaction (audit row).",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "wire_id": {
            "type": "string"
          },
          "role": {
            "type": "string"
          },
          "state": {
            "type": "string"
          },
          "outcome": {
            "type": [
              "string",
              "null"
            ]
          },
          "awaiting": {
            "type": [
              "string",
              "null"
            ]
          },
          "counterparty_address": {
            "type": "string"
          },
          "our_address": {
            "type": "string"
          },
          "step_count": {
            "type": "integer"
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          },
          "completed_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          }
        },
        "required": [
          "id",
          "wire_id",
          "role",
          "state",
          "counterparty_address",
          "our_address",
          "created_at"
        ]
      },
      "RecipientRoute": {
        "type": "object",
        "description": "A recipient routing rule binding an address pattern to one endpoint.",
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
            "description": "Domain the route is scoped to; null = org-wide."
          },
          "match_type": {
            "type": "string",
            "enum": [
              "exact",
              "wildcard",
              "regex"
            ]
          },
          "pattern": {
            "type": "string",
            "description": "The recipient address pattern (an exact address or a wildcard)."
          },
          "pattern_norm": {
            "type": [
              "string",
              "null"
            ],
            "description": "Normalized pattern used for matching."
          },
          "endpoint_id": {
            "type": "string",
            "format": "uuid",
            "description": "The endpoint inbound mail matching this rule is delivered to."
          },
          "priority": {
            "type": "integer",
            "description": "Evaluation order within a scope; lower is checked first."
          },
          "enabled": {
            "type": "boolean"
          },
          "match_count": {
            "type": "string",
            "description": "How many emails have matched this rule (a bigint, returned as a string)."
          },
          "last_matched_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "id"
        ]
      },
      "CreateRouteInput": {
        "type": "object",
        "additionalProperties": false,
        "description": "Provide exactly one of `endpoint_id` or `function_id`. With `function_id`,\na route-target endpoint is minted for that function and the route is bound\nto it in one transaction.\n",
        "properties": {
          "match_type": {
            "type": "string",
            "enum": [
              "exact",
              "wildcard",
              "regex"
            ]
          },
          "pattern": {
            "type": "string",
            "minLength": 1,
            "maxLength": 512
          },
          "endpoint_id": {
            "type": "string",
            "format": "uuid",
            "description": "An existing endpoint to route to. Mutually exclusive with function_id."
          },
          "function_id": {
            "type": "string",
            "format": "uuid",
            "description": "Route to this function, minting its route-target endpoint if needed. Mutually exclusive with endpoint_id."
          },
          "domain_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid",
            "description": "Scope the route to a domain; defaults to the pattern's domain."
          },
          "priority": {
            "type": "integer",
            "minimum": 0,
            "maximum": 1000000
          },
          "enabled": {
            "type": "boolean"
          }
        },
        "required": [
          "match_type",
          "pattern"
        ]
      },
      "UpdateRouteInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "match_type": {
            "type": "string",
            "enum": [
              "exact",
              "wildcard",
              "regex"
            ]
          },
          "pattern": {
            "type": "string",
            "minLength": 1,
            "maxLength": 512
          },
          "endpoint_id": {
            "type": "string",
            "format": "uuid"
          },
          "domain_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid"
          },
          "priority": {
            "type": "integer",
            "minimum": 0,
            "maximum": 1000000
          },
          "enabled": {
            "type": "boolean"
          }
        }
      },
      "ReorderRoutesInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "updates": {
            "type": "array",
            "minItems": 1,
            "maxItems": 1000,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "id": {
                  "type": "string",
                  "format": "uuid"
                },
                "priority": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 1000000
                }
              },
              "required": [
                "id",
                "priority"
              ]
            }
          }
        },
        "required": [
          "updates"
        ]
      },
      "SimulateRouteInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "recipient": {
            "type": "string",
            "minLength": 1,
            "maxLength": 320
          },
          "event_type": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100,
            "description": "Event type to model; defaults to email.received."
          }
        },
        "required": [
          "recipient"
        ]
      },
      "RouteEvaluatedEntry": {
        "type": "object",
        "properties": {
          "route_id": {
            "type": "string"
          },
          "tier": {
            "type": "string",
            "enum": [
              "exact",
              "wildcard",
              "regex"
            ]
          },
          "pattern": {
            "type": "string"
          },
          "result": {
            "type": "string",
            "enum": [
              "hit",
              "miss",
              "skipped",
              "error"
            ]
          },
          "reason": {
            "type": "string"
          }
        },
        "required": [
          "route_id",
          "tier",
          "pattern",
          "result"
        ]
      },
      "SimulateRouteResult": {
        "type": "object",
        "description": "Where an inbound email to the recipient would be delivered, and why.",
        "properties": {
          "outcome": {
            "type": "string",
            "enum": [
              "matched",
              "defaulted",
              "none"
            ]
          },
          "recipient": {
            "type": "string"
          },
          "endpoint_id": {
            "type": [
              "string",
              "null"
            ]
          },
          "matched_route_id": {
            "type": [
              "string",
              "null"
            ]
          },
          "matched_tier": {
            "type": [
              "string",
              "null"
            ],
            "enum": [
              "exact",
              "wildcard",
              "regex",
              null
            ]
          },
          "matched_pattern": {
            "type": [
              "string",
              "null"
            ]
          },
          "default_scope": {
            "type": [
              "string",
              "null"
            ],
            "enum": [
              "domain",
              "org",
              null
            ]
          },
          "evaluated": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/RouteEvaluatedEntry"
            }
          },
          "truncated": {
            "type": "boolean"
          }
        },
        "required": [
          "outcome",
          "recipient",
          "endpoint_id",
          "matched_route_id",
          "matched_tier",
          "matched_pattern",
          "default_scope",
          "evaluated",
          "truncated"
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
      "FunctionRouting": {
        "type": "object",
        "description": "A single route binding for a function. `domain` is null when the\nbinding is the org's fallback (any active domain without a scoped\nbinding); otherwise it carries the scoped domain. `rules` is\nreserved for future routing predicates.\n",
        "properties": {
          "endpoint_id": {
            "type": "string",
            "format": "uuid"
          },
          "enabled": {
            "type": "boolean"
          },
          "domain": {
            "type": [
              "object",
              "null"
            ],
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
              "id"
            ]
          },
          "rules": {
            "type": "object",
            "description": "Future routing predicates. Currently empty."
          },
          "delivery_count": {
            "type": "integer"
          },
          "success_count": {
            "type": "integer"
          },
          "failure_count": {
            "type": "integer"
          },
          "consecutive_fails": {
            "type": "integer"
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
          }
        },
        "required": [
          "endpoint_id",
          "enabled",
          "domain",
          "rules"
        ]
      },
      "RoutingTopology": {
        "type": "object",
        "description": "Org-wide map of function routing: which domain points at which\nfunction, the org's fallback binding (if any), and every\ndeployed function with no route currently bound.\n",
        "properties": {
          "domains": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "domain_id": {
                  "type": "string",
                  "format": "uuid"
                },
                "domain": {
                  "type": "string"
                },
                "routed_function": {
                  "type": [
                    "object",
                    "null"
                  ],
                  "properties": {
                    "id": {
                      "type": "string",
                      "format": "uuid"
                    },
                    "name": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "id",
                    "name"
                  ]
                },
                "endpoint_enabled": {
                  "type": [
                    "boolean",
                    "null"
                  ]
                }
              },
              "required": [
                "domain_id",
                "domain",
                "routed_function",
                "endpoint_enabled"
              ]
            }
          },
          "fallback_function": {
            "type": [
              "object",
              "null"
            ],
            "properties": {
              "id": {
                "type": "string",
                "format": "uuid"
              },
              "name": {
                "type": "string"
              }
            },
            "required": [
              "id",
              "name"
            ]
          },
          "fallback_enabled": {
            "type": [
              "boolean",
              "null"
            ]
          },
          "unrouted_functions": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "format": "uuid"
                },
                "name": {
                  "type": "string"
                }
              },
              "required": [
                "id",
                "name"
              ]
            }
          }
        },
        "required": [
          "domains",
          "fallback_function",
          "fallback_enabled",
          "unrouted_functions"
        ]
      },
      "FunctionRouteBody": {
        "type": "object",
        "description": "Target for a route binding. Either a specific verified domain\n(scoped) or the org-wide fallback. Pass `takeover: true` to\ndeactivate any conflicting binding before installing this one.\n",
        "properties": {
          "target": {
            "oneOf": [
              {
                "type": "object",
                "properties": {
                  "kind": {
                    "type": "string",
                    "enum": [
                      "domain"
                    ]
                  },
                  "domainId": {
                    "type": "string",
                    "format": "uuid"
                  }
                },
                "required": [
                  "kind",
                  "domainId"
                ]
              },
              {
                "type": "object",
                "properties": {
                  "kind": {
                    "type": "string",
                    "enum": [
                      "fallback"
                    ]
                  }
                },
                "required": [
                  "kind"
                ]
              }
            ]
          },
          "takeover": {
            "type": "boolean",
            "description": "When true, deactivate any conflicting binding before installing this one."
          }
        },
        "required": [
          "target"
        ]
      },
      "FunctionRouteResult": {
        "type": "object",
        "description": "On success, carries the new `routing`. On conflict, carries\n`conflict` describing the binding holder so the caller can\nre-issue with `takeover: true`.\n",
        "properties": {
          "routing": {
            "oneOf": [
              {
                "$ref": "#/components/schemas/FunctionRouting"
              },
              {
                "type": "null"
              }
            ]
          },
          "conflict": {
            "type": "object",
            "properties": {
              "kind": {
                "type": "string",
                "enum": [
                  "http",
                  "function"
                ]
              },
              "functionId": {
                "type": [
                  "string",
                  "null"
                ],
                "format": "uuid"
              },
              "functionName": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "url": {
                "type": [
                  "string",
                  "null"
                ]
              }
            },
            "required": [
              "kind"
            ]
          }
        }
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
      },
      "OrgSecretListItem": {
        "type": "object",
        "description": "One row from GET /org/secrets. Org secrets are always user-set\n(there are no managed org secrets), so `created_at` /\n`updated_at` are always present.\n",
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
          }
        },
        "required": [
          "key",
          "created_at",
          "updated_at"
        ]
      },
      "CreateOrgSecretInput": {
        "type": "object",
        "additionalProperties": false,
        "description": "Body for POST /org/secrets.",
        "properties": {
          "key": {
            "type": "string",
            "pattern": "^[A-Z_][A-Z0-9_]*$",
            "description": "Uppercase letters, digits, and underscores. Must start with\na letter or underscore. System-managed keys are reserved.\n"
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
      "SetOrgSecretInput": {
        "type": "object",
        "additionalProperties": false,
        "description": "Body for PUT /org/secrets/{key}. Key comes from the path.",
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
      "OrgSecretWriteResult": {
        "type": "object",
        "description": "Returned by POST and PUT org secret routes.",
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
      },
      "NumericString": {
        "type": "string",
        "pattern": "^[0-9]+$",
        "description": "Bigint counter serialized as a base-10 string."
      },
      "MemoryJsonValue": {
        "description": "JSON value accepted by Primitive Memories. The server accepts strings,\nnumbers, booleans, null, arrays, and objects, validates nested values,\nand rejects values that do not serialize as JSON.\n",
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "string"
          },
          {
            "type": "number"
          },
          {
            "type": "boolean"
          },
          {
            "type": "array",
            "items": {
              "description": "Any nested JSON value."
            }
          },
          {
            "type": "object",
            "additionalProperties": {
              "description": "Any nested JSON value."
            }
          }
        ]
      },
      "MemoryScope": {
        "description": "Memory scope. `org` resolves to the authenticated organization.\n`function` requires the function id UUID in `id`; function names are\nnot valid scope identifiers.\n",
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "type": {
                "type": "string",
                "enum": [
                  "org"
                ]
              }
            },
            "required": [
              "type"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "type": {
                "type": "string",
                "enum": [
                  "function"
                ]
              },
              "id": {
                "type": "string",
                "format": "uuid",
                "description": "Function id UUID."
              }
            },
            "required": [
              "type",
              "id"
            ]
          }
        ]
      },
      "MemoryResolvedScope": {
        "type": "object",
        "additionalProperties": false,
        "description": "Resolved memory scope returned by the API.",
        "properties": {
          "type": {
            "type": "string",
            "enum": [
              "org",
              "function"
            ]
          },
          "id": {
            "type": "string",
            "format": "uuid",
            "description": "Org id for org scope, function id for function scope."
          }
        },
        "required": [
          "type",
          "id"
        ]
      },
      "MemoryRecord": {
        "type": "object",
        "additionalProperties": false,
        "description": "Metadata for a Primitive memory. Search responses omit `value` when\n`include_value=false`.\n",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "key": {
            "type": "string",
            "minLength": 1,
            "maxLength": 512,
            "description": "Caller-defined key, at most 512 UTF-8 bytes."
          },
          "scope": {
            "$ref": "#/components/schemas/MemoryResolvedScope"
          },
          "value": {
            "$ref": "#/components/schemas/MemoryJsonValue"
          },
          "version": {
            "$ref": "#/components/schemas/NumericString"
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time"
          },
          "last_read_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time",
            "description": "Last successful get timestamp, or null before any get."
          },
          "read_count": {
            "$ref": "#/components/schemas/NumericString"
          },
          "write_count": {
            "$ref": "#/components/schemas/NumericString"
          },
          "expires_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time",
            "description": "Expiration timestamp, or null for no TTL."
          },
          "created_by": {
            "type": [
              "string",
              "null"
            ],
            "description": "Actor that created the memory, when available."
          },
          "updated_by": {
            "type": [
              "string",
              "null"
            ],
            "description": "Actor that last updated the memory, when available."
          }
        },
        "required": [
          "id",
          "key",
          "scope",
          "version",
          "created_at",
          "updated_at",
          "last_read_at",
          "read_count",
          "write_count",
          "expires_at",
          "created_by",
          "updated_by"
        ]
      },
      "MemoryRecordWithValue": {
        "type": "object",
        "additionalProperties": false,
        "description": "Memory record returned by get and set operations.",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "key": {
            "type": "string",
            "minLength": 1,
            "maxLength": 512,
            "description": "Caller-defined key, at most 512 UTF-8 bytes."
          },
          "scope": {
            "$ref": "#/components/schemas/MemoryResolvedScope"
          },
          "value": {
            "$ref": "#/components/schemas/MemoryJsonValue"
          },
          "version": {
            "$ref": "#/components/schemas/NumericString"
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time"
          },
          "last_read_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time",
            "description": "Last successful get timestamp, or null before any get."
          },
          "read_count": {
            "$ref": "#/components/schemas/NumericString"
          },
          "write_count": {
            "$ref": "#/components/schemas/NumericString"
          },
          "expires_at": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time",
            "description": "Expiration timestamp, or null for no TTL."
          },
          "created_by": {
            "type": [
              "string",
              "null"
            ],
            "description": "Actor that created the memory, when available."
          },
          "updated_by": {
            "type": [
              "string",
              "null"
            ],
            "description": "Actor that last updated the memory, when available."
          }
        },
        "required": [
          "id",
          "key",
          "scope",
          "value",
          "version",
          "created_at",
          "updated_at",
          "last_read_at",
          "read_count",
          "write_count",
          "expires_at",
          "created_by",
          "updated_by"
        ]
      },
      "SetMemoryInput": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "key": {
            "type": "string",
            "minLength": 1,
            "maxLength": 512,
            "description": "Caller-defined key, at most 512 UTF-8 bytes."
          },
          "value": {
            "$ref": "#/components/schemas/MemoryJsonValue"
          },
          "scope": {
            "$ref": "#/components/schemas/MemoryScope"
          },
          "ttl_seconds": {
            "type": "integer",
            "minimum": 1,
            "maximum": 31536000,
            "description": "Set or replace the TTL in seconds. Mutually exclusive with\n`expires_at` and `clear_ttl`.\n"
          },
          "expires_at": {
            "type": "string",
            "format": "date-time",
            "description": "Set or replace the absolute expiration timestamp. Mutually\nexclusive with `ttl_seconds` and `clear_ttl`.\n"
          },
          "clear_ttl": {
            "type": "boolean",
            "description": "Clear any existing TTL. Mutually exclusive with `ttl_seconds` and\n`expires_at`.\n"
          },
          "if_absent": {
            "type": "boolean",
            "description": "Create only when the key is absent. Mutually exclusive with\n`if_version`.\n"
          },
          "if_version": {
            "$ref": "#/components/schemas/NumericString"
          }
        },
        "required": [
          "key",
          "value"
        ]
      },
      "DeleteMemoryResult": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "deleted": {
            "type": "boolean"
          },
          "key": {
            "type": "string"
          },
          "scope": {
            "$ref": "#/components/schemas/MemoryResolvedScope"
          }
        },
        "required": [
          "deleted",
          "key",
          "scope"
        ]
      },
      "TemplateAuthor": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1
          },
          "name": {
            "type": "string",
            "minLength": 1
          },
          "url": {
            "type": "string",
            "format": "uri"
          }
        },
        "required": [
          "id",
          "name"
        ]
      },
      "TemplateSource": {
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "mode": {
                "type": "string",
                "const": "managed-build"
              },
              "dir": {
                "type": "string",
                "minLength": 1,
                "default": "."
              }
            },
            "required": [
              "mode",
              "dir"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "mode": {
                "type": "string",
                "const": "bundle"
              },
              "file": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "mode",
              "file"
            ]
          }
        ]
      },
      "TemplateInstall": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "mode": {
            "type": "string",
            "enum": [
              "deploy",
              "scaffold"
            ]
          },
          "editFiles": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          },
          "reason": {
            "type": "string",
            "default": ""
          }
        },
        "required": [
          "mode",
          "editFiles",
          "reason"
        ]
      },
      "TemplateSecret": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "key": {
            "type": "string",
            "pattern": "^[A-Z_][A-Z0-9_]*$"
          },
          "required": {
            "type": "boolean",
            "default": true
          },
          "description": {
            "type": "string"
          }
        },
        "required": [
          "key",
          "required"
        ]
      },
      "TemplateSecretGroup": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "keys": {
            "type": "array",
            "minItems": 2,
            "items": {
              "type": "string",
              "pattern": "^[A-Z_][A-Z0-9_]*$"
            }
          },
          "min": {
            "type": "integer",
            "minimum": 1,
            "default": 1
          },
          "description": {
            "type": "string"
          }
        },
        "required": [
          "keys",
          "min"
        ]
      },
      "TemplateVariableValidation": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "pattern": {
            "type": "string",
            "minLength": 1
          },
          "maxLength": {
            "type": "integer",
            "minimum": 1
          }
        }
      },
      "TemplateVariable": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "key": {
            "type": "string",
            "minLength": 1
          },
          "prompt": {
            "type": "string",
            "minLength": 1
          },
          "default": {
            "type": "string"
          },
          "file": {
            "type": "string",
            "minLength": 1
          },
          "type": {
            "type": "string",
            "enum": [
              "string",
              "select",
              "url",
              "email"
            ],
            "default": "string"
          },
          "options": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          },
          "validation": {
            "$ref": "#/components/schemas/TemplateVariableValidation"
          }
        },
        "required": [
          "key",
          "prompt",
          "type"
        ]
      },
      "TemplateSetup": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "agent": {
            "type": "string",
            "minLength": 1
          },
          "prompt": {
            "type": "string",
            "minLength": 1
          },
          "produces": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          }
        },
        "required": [
          "agent",
          "prompt",
          "produces"
        ]
      },
      "TemplateManifest": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "schemaVersion": {
            "type": "integer",
            "const": 1
          },
          "id": {
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9_-]{0,62}$",
            "description": "Stable template slug from the manifest."
          },
          "title": {
            "type": "string",
            "minLength": 1
          },
          "summary": {
            "type": "string",
            "minLength": 1
          },
          "description": {
            "type": "string"
          },
          "author": {
            "$ref": "#/components/schemas/TemplateAuthor"
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          },
          "source": {
            "$ref": "#/components/schemas/TemplateSource"
          },
          "install": {
            "$ref": "#/components/schemas/TemplateInstall"
          },
          "secrets": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/TemplateSecret"
            }
          },
          "secretGroups": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/TemplateSecretGroup"
            }
          },
          "variables": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/TemplateVariable"
            }
          },
          "setup": {
            "$ref": "#/components/schemas/TemplateSetup"
          },
          "postInstall": {
            "type": "string"
          }
        },
        "required": [
          "schemaVersion",
          "id",
          "title",
          "summary",
          "author",
          "tags",
          "source",
          "install",
          "secrets",
          "secretGroups",
          "variables"
        ]
      },
      "TemplateRegistryStatus": {
        "type": "string",
        "enum": [
          "pending",
          "approved",
          "rejected"
        ]
      },
      "TemplateRegistrySummary": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "slug": {
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9_-]{0,62}$",
            "description": "Stable template slug used in template URLs and install commands."
          },
          "title": {
            "type": "string"
          },
          "summary": {
            "type": "string"
          },
          "author": {
            "$ref": "#/components/schemas/TemplateAuthor"
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "verified": {
            "type": "boolean"
          },
          "install_count": {
            "type": "integer",
            "minimum": 0
          },
          "github_repo": {
            "type": "string",
            "pattern": "^[A-Za-z0-9-]+/[A-Za-z0-9_.-]+$",
            "description": "GitHub repository in owner/repo form."
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
          "slug",
          "title",
          "summary",
          "author",
          "tags",
          "verified",
          "install_count",
          "github_repo",
          "created_at",
          "updated_at"
        ]
      },
      "TemplateRegistryDetail": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "slug": {
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9_-]{0,62}$",
            "description": "Stable template slug used in template URLs and install commands."
          },
          "title": {
            "type": "string"
          },
          "summary": {
            "type": "string"
          },
          "author": {
            "$ref": "#/components/schemas/TemplateAuthor"
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "verified": {
            "type": "boolean"
          },
          "install_count": {
            "type": "integer",
            "minimum": 0
          },
          "github_repo": {
            "type": "string",
            "pattern": "^[A-Za-z0-9-]+/[A-Za-z0-9_.-]+$",
            "description": "GitHub repository in owner/repo form."
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time"
          },
          "description": {
            "type": [
              "string",
              "null"
            ]
          },
          "github_sha": {
            "type": "string"
          },
          "github_path": {
            "type": [
              "string",
              "null"
            ]
          },
          "manifest": {
            "$ref": "#/components/schemas/TemplateManifest"
          },
          "readme": {
            "type": [
              "string",
              "null"
            ]
          },
          "status": {
            "$ref": "#/components/schemas/TemplateRegistryStatus"
          }
        },
        "required": [
          "id",
          "slug",
          "title",
          "summary",
          "author",
          "tags",
          "verified",
          "install_count",
          "github_repo",
          "created_at",
          "updated_at",
          "description",
          "github_sha",
          "github_path",
          "manifest",
          "readme",
          "status"
        ]
      },
      "TemplateRegistryPage": {
        "type": "object",
        "properties": {
          "items": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/TemplateRegistrySummary"
            }
          },
          "next_cursor": {
            "type": [
              "string",
              "null"
            ],
            "description": "Cursor to pass as the next `cursor` query value, or null when there are no more templates."
          }
        },
        "required": [
          "items",
          "next_cursor"
        ]
      },
      "InstallTemplateBody": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "address": {
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9._-]{0,63}$",
            "description": "Localpart to claim on the selected inbound domain. Defaults to the template slug."
          },
          "domain": {
            "type": "string",
            "minLength": 3,
            "description": "Org domain name to claim the address on. Defaults to the org's newest active domain."
          },
          "variables": {
            "type": "object",
            "additionalProperties": {
              "type": "string"
            },
            "description": "Template variable values keyed by manifest variable key."
          },
          "secrets": {
            "type": "object",
            "additionalProperties": {
              "type": "string"
            },
            "description": "Secret values keyed by manifest secret key."
          }
        }
      },
      "TemplateInstallState": {
        "type": "string",
        "enum": [
          "deploying",
          "connecting",
          "bound",
          "tested",
          "deploy_failed",
          "bind_failed",
          "test_failed"
        ]
      },
      "TemplateInstallStatus": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "template_slug": {
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9_-]{0,62}$",
            "description": "Template slug for this install."
          },
          "state": {
            "$ref": "#/components/schemas/TemplateInstallState"
          },
          "address": {
            "type": [
              "string",
              "null"
            ]
          },
          "function_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid"
          },
          "error": {
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
          "template_slug",
          "state",
          "address",
          "function_id",
          "error",
          "created_at",
          "updated_at"
        ]
      }
    }
  }
};
