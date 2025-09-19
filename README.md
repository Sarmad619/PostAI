# PostAI — Post Generator Agent

This workspace contains a full-stack app: a Node.js + Express backend and a React + TypeScript + Tailwind frontend.

Overview:
- `server/`: Express TypeScript backend that calls OpenAI and performs a web search.
- `client/`: Vite + React + TypeScript frontend styled with Tailwind.

Quick start (from project root):

1. Server
   - cd `server`
   - npm install
   - copy `.env.example` to `.env` and set `OPENAI_API_KEY` (and `SEARCH_API_KEY` if you have one)
   - npm run dev

2. Client
   - cd `client`
   - npm install
   - npm run dev

The client expects the server to be proxied at `/api` (you can configure proxy in `client/package.json` or use a browser extension).

Security & limits:
- Server reads `OPENAI_API_KEY` and `SEARCH_API_KEY` from `server/.env`.
- The server applies basic protections: CORS origin is controlled by `CORS_ORIGIN` (default `http://localhost:3000`), request body size limit (10kb), a simple per-IP rate limiter (`MAX_REQ_PER_MINUTE`, default 10), prompt length limit (1000 chars), and a small profanity filter. Search context is limited to the first 5 results.

