import { ListenStateError } from "./listen-state.js";

export class NativeSessionError extends ListenStateError {
  constructor(
    message: string,
    readonly submitted = false,
  ) {
    super(message);
  }
}

/** A known transport loss before dispatch permits automatic reconnect. */
export class NativeSessionDisconnectedError extends NativeSessionError {
  constructor() {
    super("The native session connection is unavailable.");
  }
}

/** A verified receiver may wait for its owner to reload this exact session. */
export class NativeSessionNotLoadedError extends NativeSessionError {
  constructor() {
    super("Open this exact session in the native terminal before listening.");
  }
}

/** Durable submitting/unknown receipts must never become safe retries. */
export class NotificationOutcomeUnknownError extends NativeSessionError {
  constructor(message: string) {
    super(message, true);
  }
}
