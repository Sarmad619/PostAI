Server (Express + TypeScript)

Install and run:

```powershell
cd server
npm install
cp .env.example .env
# set OPENAI_API_KEY and optionally SEARCH_API_KEY in .env
npm run dev
```

API:
- `POST /generate` { prompt }
- `GET /health`
