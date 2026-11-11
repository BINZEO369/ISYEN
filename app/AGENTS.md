# `app/` — User Application Instructions

This package owns the entire end-user application. Put all user-facing pages, layouts, React components, styles, browser interactions, forms, and navigation here. The current Next.js App Router root is `app/` within this package; package configuration and its README are also local to this folder.

Use only HTML5/CSS3, JavaScript, TypeScript/TSX, React, Next.js, and Tailwind CSS from the approved ISYEN stack. Do not add a different programming language, runtime, framework, or MQTT integration. Keep dependencies managed by the root pnpm workspace and do not create a nested workspace or lockfile.

Do not put admin-only pages or backend endpoints in this package. Do not import implementation files from `server/` or `management/`; call backend capabilities through the REST/WebSocket contracts documented and implemented in `server/`.

Supabase is not connected yet. Any `NEXT_PUBLIC_*` configuration must be public-only. Never add a service-role key, database password, signing secret, or other private credential to frontend source, `.env.example`, or a browser bundle. Do not implement a live Supabase connection until the user approves that integration and supplies configuration through a secure channel.

The current page is an intentional scaffold placeholder. Keep the package buildable with `pnpm --filter @isyen/app build`; update tests and documentation when approved user-facing functionality is implemented.
