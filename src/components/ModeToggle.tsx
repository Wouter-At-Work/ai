export type ReviewMode = "agent" | "bitbucket";

export function ModeToggle({
  mode,
  onChange,
  agentWaiting,
}: {
  mode: ReviewMode;
  onChange(mode: ReviewMode): void;
  agentWaiting: boolean;
}) {
  return (
    <div className="segmented" role="group" aria-label="Where the review goes">
      <button
        type="button"
        aria-pressed={mode === "agent"}
        onClick={() => onChange("agent")}
        title={agentWaiting ? "Send the review to the waiting agent" : "Copy the review for an agent"}
      >
        <span className={`agent-dot${agentWaiting ? " live" : ""}`} aria-hidden />
        Agent
      </button>
      <button
        type="button"
        aria-pressed={mode === "bitbucket"}
        onClick={() => onChange("bitbucket")}
        title="Post the review on the pull request"
      >
        Bitbucket
      </button>
    </div>
  );
}
