import type { AgentVerdict } from "../../shared/agent-review";
import type { VerdictOption } from "../components/SubmitReview";

export const AGENT_VERDICTS: VerdictOption<Exclude<AgentVerdict, "dismissed">>[] = [
  { value: "changes", label: "Request changes", hint: "The agent fixes every comment." },
  { value: "approve", label: "Approve", hint: "No changes needed; comments are optional suggestions." },
];
