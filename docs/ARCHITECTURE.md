# ISYEN Architecture and Folder Ownership

This document defines where future work belongs. The repository is a starter scaffold, not a completed smart-home product. Read it together with the root `AGENTS.md` and the relevant package-level instructions.

## Top-level layout

```text
ISYEN/
├── app/                 # Complete end-user interface package
├── server/              # Backend endpoints and server configuration package
├── management/          # Complete administrator/management interface package
├── docs/                # Long-form documentation only
├── AGENTS.md            # Rules for all coding agents and contributors
├── README.md            # GitHub/repository entry point
├── package.json         # Root pnpm orchestration
├── pnpm-workspace.yaml  # The three-package workspace definition
└── pnpm-lock.yaml       # Single repository dependency lockfile
```

There are exactly four tracked top-level folders: the three code packages `app/`, `server/`, and `management/`, plus documentation-only `docs/`. Do not add a fifth tracked top-level folder. Keep long-form documents in `docs/`. Required tool-discovered files such as `README.md`, `AGENTS.md`, `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.gitignore`, `.dockerignore`, `.editorconfig`, and `.nvmrc` remain at the root because moving them may break package, Git, editor, or agent tooling.

## Ownership

### `app/` — User Application

All end-user-facing pages, layouts, React components, styling, browser interactions, and user navigation belong here. The current Next.js App Router is under `app/app/`. As the application grows, add components and user-facing modules beneath this package, keeping all UI code here. User requests reach backend capabilities through the server's documented REST/WebSocket contract.

Do not place admin-only pages, privileged server logic, credentials, or database service-role access in this package.

### `server/` — Backend and APIs

All backend endpoints and server configuration belong here. Node.js/TypeScript service startup and runtime configuration are in `server/src/`; the current `GET /health` endpoint is a liveness check only. As implementation grows, keep API route registration/handlers, request schemas, server plugins, services, repositories, and integration adapters under `server/src/` in clearly named subfolders.

REST endpoints and authenticated WebSocket events are defined and enforced here. This package owns input validation, authentication/authorization decisions, privileged operations, and future Supabase server access. Do not place page rendering or browser components here. Supabase has not been connected; no database schema or migration has been applied. MQTT is excluded.

### `management/` — Admin and Management Interface

Every admin/management page, layout, React component, style, and administrator-facing interaction belongs here. The current Next.js App Router is under `management/app/`. As admin pages grow, keep them in this package and call backend capabilities via the server contract.

The UI may hide controls for usability, but it must never be the security boundary. The server validates administrator identity and permission for every protected operation. Do not put public user-application pages, server endpoints, or server-only secrets in this package.

## Approved implementation stack

Application source is limited to HTML5, CSS3, JavaScript, and TypeScript/TSX using React, Next.js, and Tailwind CSS; the backend runtime is Node.js. Supabase, REST, and WebSocket are approved integrations/protocols. Do not introduce additional programming languages, frameworks, runtimes, MQTT, or database migration languages without explicit user approval. JSON/YAML/Markdown and `Dockerfile` are configuration/documentation formats needed by the repository tooling.

## Local package configuration

| Package | Workspace name | Local port | Responsibility |
| --- | --- | ---: | --- |
| `app/` | `@isyen/app` | 3000 | End-user interface |
| `management/` | `@isyen/management` | 3001 | Admin interface |
| `server/` | `@isyen/server` | 4000 | Backend and health endpoint |

Root `pnpm dev` runs the three packages in parallel. Root `pnpm check` runs lint, typecheck, tests, and production builds. Keep dependency installation and lockfile changes at the root workspace.

## Current integration status

The user/admin applications are placeholder starter pages. The server only provides a liveness endpoint and future integration placeholders. REST/WebSocket product contracts and Supabase database/Auth/Storage provisioning remain future coding tasks. No credentials are included. Do not represent a placeholder as a working integration.
