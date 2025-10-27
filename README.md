# Project X – Multi-Agent Research Assistant

Project X is a Next.js 15 template tailored for strategy consulting and investment teams. It delivers a modern chat experience powered by a multi-agent pipeline that converts business questions into structured analyses backed by trusted, auditable sources. The full product vision lives in `docs/SPEC.md`; the current implementation reflects the MVP scope.

## Highlights

- **Assistant-grade chat experience**: real-time interface with streaming responses, inline suggestions, attachment support, and automatic chat history.
- **Artifact workspace**: side panel for AI-assisted document, code, and spreadsheet creation with live versioning and review tools.
- **LangGraph multi-agent pipeline**: orchestrated chain that enhances prompts, plans execution, and curates data sources (agents 0–10 as defined in the spec).
- **Persistence and traceability**: Drizzle ORM on PostgreSQL (Neon-ready), file uploads via Vercel Blob, usage analytics enriched with TokenLens.
- **Auth and governance**: Auth.js with guest onboarding, per-user quotas, and per-chat public/private visibility.
- **Observability and extensibility**: OpenTelemetry instrumentation, TanStack Query hooks, modular setup for adding tools or new model providers.

## Agent Pipeline

| Agent | Role (see SPEC) | Implementation status |
| --- | --- | --- |
| 0. User identification | Tailor tone and depth to the profile | User profile loaded for authenticated sessions (`lib/db/queries`) and forwarded to agents where available. |
| 1. Topic classification | Sector and function tagging | Handled by the prompt enhancement agent (Agent 2) which extracts sector/function fields. |
| 2. Prompt enhancement | Framework selection, SMART goals, structure | Implemented in `lib/lang-graph/agents/tiager-prompt-enhancer.ts`. |
| 3. Scope management | Checklist and execution plan | Implemented in `lib/lang-graph/agents/03-lead-manager.ts`. |
| 4. Source management | Curate trusted sources and company URLs | Implemented in `lib/lang-graph/agents/04-data-source-manager.ts` using LangChain tools (SerpAPI, Calculator). |
| 5–10 | Data connection → Quality control | Scaffolds present in `lib/lang-graph/agents/05-10*` and ready for roadmap phases 2–4. |

The orchestrator (`lib/lang-graph/orchestrator/orchestrator.ts`) composes these agents with LangGraph and exposes HTTP handlers in `app/(chat)/api/agents/route.ts`. The chat service consumes the final state to drive streaming responses (`app/(chat)/api/chat/route.ts`).

## Architecture

- **App Router**: `/app/(auth)` hosts authentication flows, `/app/(chat)` provides the main conversation surface with SSE streaming via the AI SDK.
- **Components**: `components/` contains chat primitives, the sidebar, the model selector (`components/model-selector.tsx`), and the artifact workspace (`components/artifact.tsx`).
- **Agents & AI**: `lib/lang-graph` defines agent logic; `lib/ai` configures models (Gemini 2.0, xAI Grok, Anthropic, Cohere, Groq) and tool integrations.
- **Data**: `lib/db` stores Drizzle schemas (chats, messages, documents, suggestions), migrations, and Postgres helpers. File uploads flow through `/app/(chat)/api/files` to Vercel Blob.
- **Testing**: Playwright E2E coverage in `tests/e2e/*.test.ts` for chat flows, artifacts, reasoning, and session management.
- **Product spec**: functional specification lives in `docs/SPEC.md` and should stay aligned with README updates.

## Prerequisites

- Node.js 20+
- `pnpm@9` (see `package.json#packageManager`)
- PostgreSQL database (Neon, Vercel Postgres, or self-hosted)
- Gemini 2.0 API key (required) plus optional xAI, Anthropic, Cohere, and Groq keys
- Optional: Redis for resumable streams and SerpAPI for the data-source agent

## Environment Variables

Copy `.env.example` to `.env.local` and populate the secrets before running the app.

```bash
cp .env.example .env.local
```

Key fields:

- `AUTH_SECRET` – NextAuth secret
- `AI_GATEWAY_API_KEY` – Required for non-Vercel deployments
- `POSTGRES_URL` – Drizzle/Postgres connection string
- `BLOB_READ_WRITE_TOKEN` – File storage access token
- `REDIS_URL` – Enables resumable streams (optional)
- `NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY` – Default agent model
- Additional provider keys (`NEXT_PUBLIC_ANTHROPIC_API_KEY`, `NEXT_PUBLIC_COHERE_API_KEY`, `GROQ_API_KEY`) as needed

## Quick Start

```bash
pnpm install
pnpm db:migrate     # run Drizzle migrations
pnpm dev            # start Next.js with Turbo
```

Visit [http://localhost:3000](http://localhost:3000). Guests without a session are redirected to `/api/auth/guest` for instant access.

## Useful Scripts

- `pnpm dev` – development server
- `pnpm build` – migrations + production build
- `pnpm start` – serve the `.next/` output
- `pnpm lint` / `pnpm format` – Ultracite (Biome) checks and fixes
- `pnpm db:*` – Drizzle toolkit (generate, migrate, studio, etc.)
- `pnpm test` – Playwright suite (`pnpm test -- --ui` for interactive mode)

## Testing & Quality

- Playwright E2E specs in `tests/e2e` cover the critical journeys.
- Ultracite (Biome) enforces TypeScript and React conventions (`pnpm lint`).
- Follow the Project X guidelines by adding an assertion or journey test when introducing new features.

## Roadmap Snapshot (see SPEC)

1. **Phase 1 – MVP**: full agent chain (0–10), operational chat, public data + file ingestion. ✅ In progress (agents 0–4 active).
2. **Phase 2 – Enterprise**: data connectors for paid datasets and usage-based billing.
3. **Phase 3 – Collaboration & Security**: team spaces, internal data sources (SharePoint, etc.), advanced compliance.
4. **Phase 4 – Expert Community**: verified analysts resolve data gaps surfaced by the pipeline.

Agents 5–10 are scaffolded to ease the transition into later phases.

## Deployment

- Vercel is the recommended target (AI Gateway, Blob, Postgres, Analytics supported out of the box).
- `pnpm build` runs `tsx lib/db/migrate.ts` before `next build` to keep the schema in sync.
- Configure environment variables via Vercel or `vercel env pull`.

## Contributing

Use Conventional Commits (`feat:`, `fix:`, `chore:`) and run `pnpm lint`, `pnpm format`, and `pnpm test` before submitting a PR. Update `docs/SPEC.md` alongside the README when altering functional specifications.

## License

Distributed under the [MIT](LICENSE) license.

