import type { Participant, PullRequest } from "../api/types";
import { Avatar } from "./Status";

const STATE_LABEL = {
  approved: "approved",
  changes_requested: "requested changes",
} as const;

function reviewParticipants(pr: PullRequest): Participant[] {
  const byUuid = new Map<string, Participant>();
  for (const reviewer of pr.reviewers) {
    byUuid.set(reviewer.uuid, { user: reviewer, role: "REVIEWER", approved: false, state: null });
  }
  for (const participant of pr.participants) {
    if (participant.role === "REVIEWER" || participant.state) {
      byUuid.set(participant.user.uuid, participant);
    }
  }
  return [...byUuid.values()];
}

export function ReviewerStack({ pr }: { pr: PullRequest }) {
  return (
    <span className="reviewers">
      {reviewParticipants(pr).map((participant) => (
        <span
          key={participant.user.uuid}
          className={`reviewer reviewer-${participant.state ?? "pending"}`}
          title={`${participant.user.display_name}${participant.state ? ` ${STATE_LABEL[participant.state]}` : ""}`}
        >
          <Avatar account={participant.user} size={24} />
        </span>
      ))}
    </span>
  );
}
