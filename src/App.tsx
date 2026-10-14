import { useQuery } from "@tanstack/react-query";
import { meQuery } from "./api/queries";
import type { Account } from "./api/types";
import { ErrorBox } from "./components/Status";
import { useRoute } from "./lib/route";
import { PullRequestList } from "./pages/PullRequestList";
import { LocalReviewView } from "./pages/LocalReviewView";
import { PullRequestView } from "./pages/PullRequestView";

const YOU: Account = { uuid: "you", display_name: "You", links: { avatar: { href: "" } } };

export function App() {
  const route = useRoute();
  const me = useQuery(meQuery);

  if (route.page === "local") {
    return <LocalReviewView key={route.session} sessionId={route.session} me={me.data ?? YOU} />;
  }
  if (me.isError) {
    return (
      <main className="page">
        <ErrorBox
          title="Could not reach Bitbucket"
          error={me.error}
          hint="Check BITBUCKET_EMAIL and BITBUCKET_API_TOKEN in .env, then restart the dev server."
        />
      </main>
    );
  }
  if (!me.data) return <main className="page muted">Connecting to Bitbucket…</main>;

  return route.page === "pr" ? (
    <PullRequestView
      key={`${route.repo}/${route.id}/${route.agentSession}`}
      repo={route.repo}
      id={route.id}
      me={me.data}
      agentSession={route.agentSession}
    />
  ) : (
    <PullRequestList me={me.data} />
  );
}
