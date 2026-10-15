import { useQueries, useQuery } from "@tanstack/react-query";
import { pullRequestsQuery, reposQuery } from "../api/queries";
import type { Account, PullRequest } from "../api/types";
import { ReviewerStack } from "../components/Reviewers";
import { Avatar, CommentCount, ErrorBox, timeAgo } from "../components/Status";
import { config } from "../config";
import { prHref } from "../lib/route";

type Bucket = "waiting" | "reviewed" | "mine" | "other";

function bucketOf(pr: PullRequest, me: Account): Bucket {
  if (pr.author.uuid === me.uuid) return "mine";
  const mine = pr.participants.find((participant) => participant.user.uuid === me.uuid);
  const isReviewer = pr.reviewers.some((reviewer) => reviewer.uuid === me.uuid);
  if (mine?.state) return "reviewed";
  return isReviewer ? "waiting" : "other";
}

const BUCKETS: { key: Bucket; title: string }[] = [
  { key: "waiting", title: "To review" },
  { key: "reviewed", title: "Reviewed" },
  { key: "mine", title: "Yours" },
  { key: "other", title: "Other" },
];

export function PullRequestList({ me }: { me: Account }) {
  const repos = useQuery(reposQuery);
  const results = useQueries({
    queries: (repos.data ?? []).map((repo) => pullRequestsQuery(repo)),
  });

  const loading = repos.isPending || results.some((result) => result.isPending);
  const failures = results.flatMap((result, index) =>
    result.isError ? [{ repo: repos.data?.[index], error: result.error }] : [],
  );
  const pullRequests = results
    .flatMap((result, index) =>
      (result.data ?? []).map((pr) => ({ pr, repo: repos.data?.[index] ?? "" })),
    )
    .sort((a, b) => b.pr.updated_on.localeCompare(a.pr.updated_on));

  return (
    <div className="list-page">
      <header className="top-bar">
        <a className="wordmark" href="#/">
          Visual
          <br />
          Review
        </a>
        <span className="chip-label">
          {config.workspace} · {me.display_name}
        </span>
      </header>

      <main className="list-main">
        {repos.isError && <ErrorBox title="Could not list repositories" error={repos.error} />}
        {failures.map((failure) => (
          <ErrorBox key={failure.repo} title={`Could not load ${failure.repo}`} error={failure.error} />
        ))}

        <div className="list-grid list-columns">
          <span className="label">
            {loading ? "Loading…" : `${pullRequests.length} open pull requests`}
          </span>
          <div className="label pr-cols">
            <span />
            <span>Title</span>
            <span>Repository</span>
            <span>Updated</span>
            <span />
          </div>
        </div>

        {!loading && pullRequests.length === 0 && failures.length === 0 && (
          <p className="muted empty">No open pull requests in {repos.data?.join(", ")}.</p>
        )}

        {BUCKETS.map(({ key, title }) => {
          const items = pullRequests.filter(({ pr }) => bucketOf(pr, me) === key);
          if (items.length === 0) return null;
          return (
            <section key={key} className="list-grid pr-group">
              <h2 className="group-title">
                {title}
                <span className="label">{items.length}</span>
              </h2>
              <ul className="pr-list">
                {items.map(({ pr, repo }) => (
                  <li key={`${repo}/${pr.id}`}>
                    <a
                      className="pr-cols pr-row"
                      href={prHref(repo, pr.id)}
                      title={`${pr.source.branch.name} → ${pr.destination.branch.name} · ${pr.author.display_name}`}
                    >
                      <Avatar account={pr.author} size={18} />
                      <span className="pr-row-title">
                        {pr.title}
                        {pr.draft && <span className="label"> draft</span>}
                      </span>
                      <span className="label">
                        {repo} #{pr.id}
                      </span>
                      <span className="label">{timeAgo(pr.updated_on)}</span>
                      <span className="pr-row-meta">
                        {pr.comment_count > 0 && <CommentCount count={pr.comment_count} />}
                        <ReviewerStack pr={pr} />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </main>
    </div>
  );
}
