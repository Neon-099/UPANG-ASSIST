# UPang Assist Client

This is the single JavaScript frontend for the student assistant (`/`) and administrator portal (`/admin`). Both use the same Vite server, which proxies `/api` to `http://localhost:3000` by default. Set `API_TARGET` to point the development proxy at another server, or set `VITE_API_BASE_URL` to the API base path (including `/api`) when hosting the frontend separately.

Run the backend from `server` and the frontend from this directory with `npm run dev`.

The admin portal uses the server's cookie session and requires an account with the `admin` role. Its dashboard and knowledge editor retain the `next-app` design, and knowledge entries load and save through `/api/admin/knowledge`, including visibility, search keywords, and follow-up prompts. The current server does not expose inquiry, user administration, or settings APIs, so those screens are not included.
