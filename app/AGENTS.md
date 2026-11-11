# `app/` — User Application Instructions

This package owns the entire end-user application. Put all user-facing pages, layouts, React components, styles, browser interactions, forms, and navigation here. The current Next.js App Router root is `app/` within this package; package configuration and its README are also local to this folder.

Use only HTML5/CSS3, JavaScript, TypeScript/TSX, React, Next.js, and Tailwind CSS from the approved ISYEN stack. Do not add a different programming language, runtime, framework, or MQTT integration. Keep dependencies managed by the root pnpm workspace and do not create a nested workspace or lockfile.

Do not put admin-only pages or backend endpoints in this package. Do not import implementation files from `server/` or `management/`; call backend capabilities through the REST/WebSocket contracts documented and implemented in `server/`.

Supabase Auth is user-approved for browser sign-in only. `NEXT_PUBLIC_*` configuration must be public-only (Supabase URL/publishable key); never add a service-role key, database password, signing secret, or other private credential to frontend source, `.env.example`, or a browser bundle. User-profile creation must call the server-owned registration route; profile reads must call the REST contract in `server/`.

The app owns user sign-in, registration and dashboard pages. Keep the package buildable with `pnpm --filter @isyen/app build`; update tests and documentation with user-facing functionality.
