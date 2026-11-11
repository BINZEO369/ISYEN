# `management/` — Admin Interface Instructions

This package owns every administrator/management page, layout, React component, stylesheet, admin-facing form, and admin navigation. The current Next.js App Router root is `app/` within this package. Keep future admin screens and shared admin UI within `management/`.

Use only HTML5/CSS3, JavaScript, TypeScript/TSX, React, Next.js, and Tailwind CSS from the approved ISYEN stack. Do not add a different programming language, runtime, framework, or MQTT integration. Keep dependencies in the root pnpm workspace; do not create a nested workspace or lockfile.

Do not put end-user product pages or server API handlers in this package. Do not import implementation files from `app/` or `server/`; communicate with backend capabilities through the REST/WebSocket contracts owned by `server/`.

Client-side hiding is not authorization. The server must validate every administrator identity and permission for every protected operation. Never embed service-role credentials, database passwords, tokens, or other private values in this frontend. Supabase is not connected; do not create a live connection or make database changes until the user explicitly approves that work.

The current page is an intentional placeholder, not a functioning admin dashboard. Keep the package buildable with `pnpm --filter @isyen/management build`; update tests and documentation when approved admin functionality is added.
