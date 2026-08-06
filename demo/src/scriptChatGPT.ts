// Storyline: "Primitive, inside ChatGPT" — a live agent↔agent email round-trip.
// The user asks ChatGPT to email another company's scheduling agent and WAIT;
// ChatGPT sends real mail via the Primitive connector, watches the thread, a
// real reply lands, and ChatGPT confirms back — all in one flow. This is the
// thing only a real two-way inbox makes possible.
//
// Faithfulness: the inline cards are the genuine Primitive email-console widget
// (resources/read ui://widget/primitive-email-v1.html), tool names + titles
// match the connector's toolTitles map (sendEmail→"Email sent",
// getEmail→"Email details", replyToEmail→"Reply sent"), and every payload uses
// the widget's structuredContent shape { tool, status, data } (object → Summary
// key/values). Identity is the Acme demo persona on its managed inbox.

import { f } from "./theme";

export const chatGptIntroTitle = "primitive";
export const chatGptIntroTagline = "email, inside ChatGPT";
export const chatGptOutroPrimary = "now live in the ChatGPT app directory";
export const chatGptOutroUrl = "primitive.dev/chatgpt";

export interface WidgetEmail {
  subject: string;
  from_email?: string;
  to_email?: string;
  status?: string;
}

export interface WidgetPayload {
  tool: string;
  status: number;
  // array → Messages list; object → Summary key/values.
  data: WidgetEmail[] | Record<string, string>;
}

// A conversation is an ordered list of steps. Each step renders in the
// scrollback in order; the timeline below assigns absolute frames.
export type Step =
  | { kind: "user"; text: string }
  | { kind: "tool"; tool: string; working: string; payload: WidgetPayload }
  | { kind: "wait"; label: string }
  | { kind: "say"; text: string };

export const chatSteps: Step[] = [
  {
    kind: "user",
    text: "Email the scheduling agent at scheduling@amber-finch.primitive.email — ask for their earliest demo slot next week, then wait for the reply.",
  },
  {
    kind: "tool",
    tool: "sendEmail",
    working: "Sending your email",
    payload: {
      tool: "sendEmail",
      status: 200,
      data: {
        id: "em_7c41a9d2",
        to_email: "scheduling@amber-finch.primitive.email",
        subject: "Demo availability next week",
        status: "delivered",
      },
    },
  },
  { kind: "say", text: "Sent to the scheduling agent. Watching the thread for their reply…" },
  { kind: "wait", label: "Waiting for reply from scheduling@amber-finch.primitive.email" },
  {
    kind: "tool",
    tool: "getEmail",
    working: "Reading their reply",
    payload: {
      tool: "getEmail",
      status: 200,
      data: {
        from_email: "scheduling@amber-finch.primitive.email",
        subject: "Re: Demo availability next week",
        message: "Thursday 10:00 AM PT works for us — I'll hold the slot.",
        received: "42s ago",
        status: "received",
      },
    },
  },
  { kind: "say", text: "The scheduling agent replied — earliest slot is Thursday, 10:00 AM PT. Want me to confirm it?" },
  { kind: "user", text: "Yes, confirm Thursday 10 AM." },
  {
    kind: "tool",
    tool: "replyToEmail",
    working: "Confirming the slot",
    payload: {
      tool: "replyToEmail",
      status: 200,
      data: {
        id: "em_7c41b0f5",
        to_email: "scheduling@amber-finch.primitive.email",
        subject: "Re: Demo availability next week",
        status: "delivered",
      },
    },
  },
  { kind: "say", text: "Done ✓ Confirmed Thursday, 10:00 AM PT — the whole thread is in your Primitive inbox." },
];

// ---- Timeline (baseline 30fps frames; f() scales to render fps) ----

const TYPE_CPS = 32; // composer typing speed
const ASSISTANT_CPS = 52; // reply streaming speed
const FPS_BASE = 30;

const USER_PRE = 6; // idle before the user starts typing
const USER_SEND_PAUSE = 10; // pause after typing, before send
const USER_SEND_HOLD = 12; // dwell after the bubble lands
const TOOL_WORKING = 28; // "Working" shown before the chip resolves
const TOOL_TO_WIDGET = 12; // chip resolve → card reveal
const WIDGET_DWELL = 92; // hold the card on screen to read it
const SAY_HOLD = 30; // dwell after a streamed reply
const WAIT_DUR = 112; // live "waiting for reply" beat

const typeFrames = (text: string, cps: number) => Math.max(8, Math.round((text.length / cps) * FPS_BASE));

export interface TimedStep {
  step: Step;
  start: number;
  end: number;
  // user
  typeStart?: number;
  typeDur?: number;
  sendAt?: number;
  // tool
  workingAt?: number;
  resolveAt?: number;
  widgetAt?: number;
  // say
  textDur?: number;
}

export interface ChatTimeline {
  steps: TimedStep[];
  total: number; // baseline frames
}

export function buildChatTimeline(steps: Step[] = chatSteps): ChatTimeline {
  const timed: TimedStep[] = [];
  let cursor = 0;

  for (const step of steps) {
    const start = cursor;
    if (step.kind === "user") {
      const typeStart = start + USER_PRE;
      const typeDur = typeFrames(step.text, TYPE_CPS);
      const sendAt = typeStart + typeDur + USER_SEND_PAUSE;
      const end = sendAt + USER_SEND_HOLD;
      timed.push({ step, start, end, typeStart, typeDur, sendAt });
      cursor = end;
    } else if (step.kind === "tool") {
      const workingAt = start;
      const resolveAt = start + TOOL_WORKING;
      const widgetAt = resolveAt + TOOL_TO_WIDGET;
      const end = widgetAt + WIDGET_DWELL;
      timed.push({ step, start, end, workingAt, resolveAt, widgetAt });
      cursor = end;
    } else if (step.kind === "wait") {
      const end = start + WAIT_DUR;
      timed.push({ step, start, end });
      cursor = end;
    } else {
      const textDur = typeFrames(step.text, ASSISTANT_CPS);
      const end = start + textDur + SAY_HOLD;
      timed.push({ step, start, end, textDur });
      cursor = end;
    }
  }

  return { steps: timed, total: cursor };
}

export const chatBodyFrames = (): number => f(buildChatTimeline().total);
