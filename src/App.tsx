import { useQuery } from "@tanstack/react-query";
import { meQuery } from "./api/queries";
import { ErrorBox } from "./components/Status";
import { useRoute } from "./lib/route";
import { PullRequestList } from "./pages/PullRequestList";
import { PullRequestView } from "./pages/PullRequestView";

export function App() {
  const route = useRoute();
  const me = useQuery(meQuery);

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
    <PullRequestView key={`${route.repo}/${route.id}`} repo={route.repo} id={route.id} me={me.data} />
  ) : (
    <PullRequestList me={me.data} />
  );
}
