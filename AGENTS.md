# ISYEN Repository Instructions

Read this file before changing code. Also read the nearest package-level `AGENTS.md` before editing files inside `app/`, `server/`, or `management/`. These rules preserve the product's ownership boundaries for every contributor and coding agent.

## The three primary code folders

The repository has exactly three application code areas:

- `app/` owns the complete end-user application: user-facing pages, components, styles, client-side behavior, and user-facing navigation.
- `server/` owns the backend: API endpoints, server runtime and deployment configuration, request validation, authentication/authorization enforcement, REST handlers, and WebSocket handlers.
- `management/` owns the complete administrator/management interface: admin pages, components, styles, client-side behavior, and admin navigation.

Keep each feature in its responsible folder. The four tracked top-level folders are exactly `app/`, `server/`, `management/`, and `docs/`; `docs/` is for long-form documentation only. Do not add another tracked top-level folder. Keep package instructions within their package. Do not move admin pages into `app/`, user pages into `management/`, or backend endpoints into either frontend package.

Keep tool-discovered root files at the root: `README.md`, this `AGENTS.md`, `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.gitignore`, `.dockerignore`, `.editorconfig`, and `.nvmrc`. Package managers, GitHub, editors, and coding agents expect these files there; moving them into `docs/` or a config subfolder can break tooling. Put long-form documents such as architecture, contribution, security, and development reports in `docs/`.

## Approved technology and language boundary

Use only the stack approved for ISYEN: HTML5, CSS3, JavaScript, TypeScript, React, Next.js, Tailwind CSS, Node.js, Supabase, REST APIs, and WebSocket. Frontend pages use Next.js App Router with React and TypeScript/TSX; server implementation uses Node.js and TypeScript. JavaScript is permitted for small configuration files.

Do not introduce another programming language, runtime, framework, or service without explicit user approval. In particular, do not add Python, Go, Rust, Java, PHP, shell-script source, SQL migration files, or an alternate frontend/backend framework. JSON/YAML/Markdown and the required `Dockerfile` are repository configuration/documentation formats, not additional application languages. Do not add MQTT; it is explicitly out of scope.

## Package boundaries and integration

- `app/` and `management/` communicate with backend capabilities through contracts owned by `server/`, using REST and/or authenticated WebSocket. Do not import source files across packages.
- `server/` is the sole authority for server-side validation, authentication, authorization, and privileged operations. Never trust a role or permission supplied only by a browser.
- Do not connect frontend code directly to privileged database operations. Browser-visible environment variables may contain only public configuration; server-only secrets must never use a `NEXT_PUBLIC_` prefix.
- Supabase is not connected or provisioned yet. Keep example environment values as placeholders. Do not connect a project, apply migrations, change Auth settings, or change Storage policies unless the user explicitly requests that database work.
- Keep package implementation inside its designated folder. Do not add a new top-level app, shared code package, or language-specific sidecar without user approval.

## Repository workflow

Use Node.js 22 and pnpm 11, with the root `pnpm-workspace.yaml` and root `pnpm-lock.yaml` as the single source of workspace dependency resolution. Use the package scripts already defined in the root and package manifests. Before delivery, run `pnpm install --frozen-lockfile` and `pnpm check` when dependencies or code change. Add regression tests for implemented behavior; an empty scaffold test suite is not feature coverage.

Never commit real `.env` files, credentials, tokens, service-role keys, or build outputs. Commit `.env.example` files only with dummy placeholders. Keep the three package names `@isyen/app`, `@isyen/server`, and `@isyen/management` stable unless the user approves a package rename.
