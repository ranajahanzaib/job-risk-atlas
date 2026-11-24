# Local operation and deployment status

For local development, run `pnpm install` and `pnpm dev`. Vite serves the dashboard at `http://127.0.0.1:3000` and starts the API on `http://127.0.0.1:8000`; the frontend proxies `/api`. To build and serve the production assets, run `pnpm build` followed by `python3 server.py`. Set `PORT` to change the API port (and update the Vite proxy in `vite.config.ts` if developing).

No production container, reverse-proxy configuration, hosted API setup, TLS configuration, or persistent analytical-data deployment has been implemented. The development server is not intended as a production deployment target.
