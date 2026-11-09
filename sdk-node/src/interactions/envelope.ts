/**
 * The interaction.json envelope a protocol step carries in an email. The
 * platform parses it from the `interaction.json` part of the message and
 * validates the step against the named protocol.
 */
export interface InteractionEnvelope<P = unknown> {
  interaction_version: 1;
  /** The thread id (`uuid@domain`) the step belongs to. */
  interaction_id: string;
  protocol: string;
  protocol_version: number;
  /** The protocol step name. */
  step: string;
  /** This step's id (a fresh UUID). */
  step_id: string;
  /** The id of the step this one answers, or null. */
  prev_step_id: string | null;
  expires_at: string | null;
  payload: P;
}
