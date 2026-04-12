import type { ErrorObject } from "ajv";
import validateEmailReceivedEventSchema from "./generated/email-received-event.validator.generated.js";
import type { EmailReceivedEvent } from "./types.js";
import { WebhookValidationError } from "./webhook/errors.js";

type GeneratedValidator = {
  (input: unknown): boolean;
  errors?: ErrorObject[] | null;
};

const validateSchema = validateEmailReceivedEventSchema as GeneratedValidator;

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationFailure {
  success: false;
  error: WebhookValidationError;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

type ValidationIssue = {
  field: string;
  message: string;
  suggestion: string;
};

function toFieldPath(instancePath: string): string {
  if (!instancePath) return "payload";
  return instancePath
    .replace(/^\//, "")
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"))
    .join(".");
}

function fromFieldLabel(field: string): string {
  return field === "payload" ? "webhook payload" : `"${field}"`;
}

function resolveValueAtPath(input: unknown, instancePath: string): unknown {
  if (!instancePath) {
    return input;
  }

  let current = input;
  for (const segment of instancePath.replace(/^\//, "").split("/")) {
    const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    if (Array.isArray(current)) {
      current = current[Number(key)];
      continue;
    }
    if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[key];
      continue;
    }
    return undefined;
  }

  return current;
}

function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  return typeof value;
}

function formatExpectedList(values: unknown[]): string {
  return values.map((value) => JSON.stringify(value)).join(", ");
}

function formatValidationIssue(
  error: ErrorObject,
  input: unknown,
): ValidationIssue {
  const field = toFieldPath(error.instancePath);
  const actualValue = resolveValueAtPath(input, error.instancePath);
  const actualType = describeValue(actualValue);

  switch (error.keyword) {
    case "required": {
      const missing = String(error.params.missingProperty ?? "unknown");
      const prefix = field === "payload" ? "payload" : field;
      return {
        field: prefix === "payload" ? missing : `${prefix}.${missing}`,
        message: `Missing required field: ${missing}`,
        suggestion: `Add the required field "${missing}" to the webhook payload.`,
      };
    }
    case "type": {
      const expected = String(
        (error.params as { type?: unknown }).type ?? "unknown",
      );
      if (field === "payload") {
        return {
          field,
          message: `Expected webhook payload object but received ${actualType}`,
          suggestion:
            actualType === "undefined"
              ? "No payload was provided. Make sure you're passing the parsed JSON body."
              : actualType === "null"
                ? "Received null instead of a webhook payload object. Did you forget to parse the JSON?"
                : `Received ${actualType} instead of object. Webhook payloads must be objects.`,
        };
      }

      if (expected === "unknown") {
        return {
          field,
          message: `Invalid type for ${field}: wrong type`,
          suggestion: `Check the value of ${fromFieldLabel(field)} in the webhook payload.`,
        };
      }

      let suggestion = `Check that ${fromFieldLabel(field)} is a ${expected}, not a ${actualType}.`;
      if (
        (expected === "number" || expected === "integer") &&
        actualType === "string"
      ) {
        suggestion += " Don't quote numeric values in JSON.";
      }

      return {
        field,
        message: `Invalid type for ${field}: expected ${expected} but got ${actualType}`,
        suggestion,
      };
    }
    case "enum": {
      const allowedValues = Array.isArray(
        (error.params as { allowedValues?: unknown[] }).allowedValues,
      )
        ? (error.params as { allowedValues: unknown[] }).allowedValues
        : [];
      return {
        field,
        message: `Invalid value for ${field}: got ${JSON.stringify(actualValue)}, expected one of: ${formatExpectedList(allowedValues)}`,
        suggestion: `${fromFieldLabel(field)} must be one of: ${formatExpectedList(allowedValues)}.`,
      };
    }
    case "const": {
      const allowedValue = (error.params as { allowedValue?: unknown })
        .allowedValue;
      if (allowedValue === undefined) {
        return {
          field,
          message: `Invalid value for ${field}: must match the expected constant`,
          suggestion:
            field === "event"
              ? 'This SDK handles "email.received" events. Check the event type in the webhook payload.'
              : `Check the value of ${fromFieldLabel(field)} in the webhook payload.`,
        };
      }
      return {
        field,
        message: `Invalid value for ${field}: expected ${JSON.stringify(allowedValue)}${
          actualValue === undefined
            ? ""
            : ` but got ${JSON.stringify(actualValue)}`
        }`,
        suggestion:
          field === "event"
            ? `This SDK handles ${JSON.stringify(allowedValue)} events. Check the event type in the webhook payload.`
            : `Expected the literal value ${JSON.stringify(allowedValue ?? "unknown")} for ${fromFieldLabel(field)}.`,
      };
    }
    case "format": {
      const format = String(
        (error.params as { format?: unknown }).format ?? "unknown format",
      );
      const humanFormat = format === "uri" ? "valid URI" : `valid ${format}`;
      return {
        field,
        message: `Invalid value for ${field}: must be a ${humanFormat}`,
        suggestion: field.endsWith("url")
          ? `Check that ${fromFieldLabel(field)} is a complete URL including the scheme.`
          : `Check the format of ${fromFieldLabel(field)} in the webhook payload.`,
      };
    }
    case "pattern": {
      const patternValue = (error.params as { pattern?: unknown }).pattern;
      if (patternValue === undefined) {
        return {
          field,
          message: `Validation failed for ${field}: pattern`,
          suggestion: `Check the format of ${fromFieldLabel(field)} in the webhook payload.`,
        };
      }
      const pattern = String(patternValue);
      if (field === "version") {
        return {
          field,
          message: `Invalid version format: ${JSON.stringify(actualValue ?? "unknown")}`,
          suggestion:
            'Version must be a date in YYYY-MM-DD format (e.g., "2025-12-14").',
        };
      }
      if (pattern === "^https://") {
        return {
          field,
          message: `Invalid value for ${field}: must be a valid HTTPS URL`,
          suggestion: `Check that ${fromFieldLabel(field)} is a complete URL including the scheme and uses https://.`,
        };
      }
      if (pattern === "^[a-fA-F0-9]{64}$") {
        return {
          field,
          message: `Invalid value for ${field}: must be a 64-character hex SHA-256 string`,
          suggestion: `Check that ${fromFieldLabel(field)} is the lowercase or uppercase hex SHA-256 digest.`,
        };
      }
      return {
        field,
        message: `Invalid value for ${field}: must match pattern: ${pattern}`,
        suggestion: `Check the format of ${fromFieldLabel(field)} in the webhook payload.`,
      };
    }
    case "minItems": {
      const limit = Number((error.params as { limit?: unknown }).limit ?? 0);
      const itemLabel = limit === 1 ? "item" : "items";
      return {
        field,
        message: `Invalid value for ${field}: must have at least ${limit} ${itemLabel}`,
        suggestion: `Add more entries to ${fromFieldLabel(field)} in the webhook payload.`,
      };
    }
    case "minLength": {
      const limit = Number((error.params as { limit?: unknown }).limit ?? 0);
      if (limit === 1) {
        return {
          field,
          message: `Invalid value for ${field}: must not be empty`,
          suggestion: `Check that ${fromFieldLabel(field)} is present and not an empty string.`,
        };
      }
      return {
        field,
        message: `Invalid value for ${field}: must be at least ${limit} characters long`,
        suggestion: `Check that ${fromFieldLabel(field)} meets the minimum length requirement.`,
      };
    }
    case "minimum": {
      const limit = Number((error.params as { limit?: unknown }).limit ?? 0);
      return {
        field,
        message: `Invalid value for ${field}: must be >= ${limit}`,
        suggestion: `Check that ${fromFieldLabel(field)} meets the minimum allowed value.`,
      };
    }
    case "maximum": {
      const limit = Number((error.params as { limit?: unknown }).limit ?? 0);
      return {
        field,
        message: `Invalid value for ${field}: must be <= ${limit}`,
        suggestion: `Check that ${fromFieldLabel(field)} stays within the maximum allowed value.`,
      };
    }
    default:
      return {
        field,
        message: `Validation failed for ${field}: ${error.message ?? error.keyword}`,
        suggestion: `Check the value of ${fromFieldLabel(field)} in the webhook payload.`,
      };
  }
}

function createValidationError(
  errors: readonly ErrorObject[],
  input: unknown,
): WebhookValidationError {
  if (errors.length === 0) {
    return new WebhookValidationError(
      "payload",
      "Webhook payload failed schema validation",
      'Check the structure of the webhook payload against "emailReceivedEventJsonSchema".',
      [],
    );
  }

  const firstError = errors[0];
  const { field, message, suggestion } = formatValidationIssue(
    firstError,
    input,
  );
  return new WebhookValidationError(field, message, suggestion, [...errors]);
}

export function validateEmailReceivedEvent(input: unknown): EmailReceivedEvent {
  if (!validateSchema(input)) {
    throw createValidationError(validateSchema.errors ?? [], input);
  }

  return input as EmailReceivedEvent;
}

export function safeValidateEmailReceivedEvent(
  input: unknown,
): ValidationResult<EmailReceivedEvent> {
  if (!validateSchema(input)) {
    return {
      success: false,
      error: createValidationError(validateSchema.errors ?? [], input),
    };
  }

  return {
    success: true,
    data: input as EmailReceivedEvent,
  };
}
