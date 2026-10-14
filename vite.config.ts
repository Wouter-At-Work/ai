import react from "@vitejs/plugin-react";
import { homedir } from "node:os";
import { join } from "node:path";
import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import { agentSessions } from "./server/agent-sessions";

const configDir =
  process.env.VISUAL_REVIEW_CONFIG ?? join(homedir(), ".config", "visual-review");

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, configDir, ""), ...loadEnv(mode, process.cwd(), "") };
  const apiOrigin = env.BITBUCKET_API_URL || "https://api.bitbucket.org";
  const port = Number(env.PORT || 5390);

  if (!env.BITBUCKET_EMAIL || !env.BITBUCKET_API_TOKEN) {
    console.warn(
      `\n  BITBUCKET_EMAIL / BITBUCKET_API_TOKEN missing — copy .env.example to ${join(configDir, ".env")}\n`,
    );
  }

  const authorization = `Basic ${Buffer.from(
    `${env.BITBUCKET_EMAIL ?? ""}:${env.BITBUCKET_API_TOKEN ?? ""}`,
  ).toString("base64")}`;

  const bitbucketProxy: Record<string, ProxyOptions> = {
    "/api/bb": {
      target: apiOrigin,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/bb/, ""),
      configure: (proxy) => {
        proxy.on("proxyReq", (proxyReq) => {
          proxyReq.setHeader("Authorization", authorization);
          proxyReq.removeHeader("cookie");
          proxyReq.removeHeader("origin");
          proxyReq.removeHeader("referer");
        });
        proxy.on("proxyRes", (proxyRes) => {
          const location = proxyRes.headers.location;
          if (location?.startsWith(apiOrigin)) {
            proxyRes.headers.location = `/api/bb${location.slice(apiOrigin.length)}`;
          }
        });
      },
    },
  };

  return {
    plugins: [react(), agentSessions(port, { configured: Boolean(env.BITBUCKET_API_TOKEN) })],
    define: {
      __BB_CONFIG__: JSON.stringify({
        workspace: env.BITBUCKET_WORKSPACE || "igne",
        repos: (env.BITBUCKET_REPOS ?? "")
          .split(",")
          .map((repo) => repo.trim())
          .filter(Boolean),
      }),
    },
    server: { port, strictPort: true, host: "127.0.0.1", proxy: bitbucketProxy },
    preview: { port, strictPort: true, host: "127.0.0.1", proxy: bitbucketProxy },
  };
});
