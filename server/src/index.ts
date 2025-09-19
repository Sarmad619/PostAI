import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { generatePosts, generateLinkedInText, generateXText } from "./agent";
import { webSearch } from "./websearch";

dotenv.config();

// Basic in-memory rate limiter
const rateLimitWindowMs = 60 * 1000; // 1 minute
const maxRequestsPerWindow = parseInt(process.env.MAX_REQ_PER_MINUTE || '10', 10);
const rateMap: Map<string, { count: number; windowStart: number }> = new Map();

function rateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
  const now = Date.now();
  const rec = rateMap.get(ip) || { count: 0, windowStart: now };
  if (now - rec.windowStart > rateLimitWindowMs) {
    rec.count = 0;
    rec.windowStart = now;
  }
  rec.count += 1;
  rateMap.set(ip, rec);
  if (rec.count > maxRequestsPerWindow) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  next();
}

const app = express();

const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '10kb' }));
app.use(rateLimiter);

const PORT = process.env.PORT || 4000;

import { Request, Response } from "express";

app.post("/api/generate", async (req: Request, res: Response) => {
  const { prompt } = req.body as { prompt?: string };
  if (!prompt) return res.status(400).json({ error: "prompt required" });

  const openaiKey = process.env.OPENAI_API_KEY;
  const searchKey = process.env.SEARCH_API_KEY;

  const result = await generatePosts(prompt, openaiKey, searchKey);
  res.json(result);
});

app.get("/health", (req: Request, res: Response) => res.json({ status: "ok" }));

// SSE streaming endpoint: GET /api/generate/stream?prompt=...
app.get('/api/generate/stream', async (req: Request, res: Response) => {
  const prompt = String(req.query.prompt || '');
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  const openaiKey = process.env.OPENAI_API_KEY;
  const searchKey = process.env.SEARCH_API_KEY;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (ev: string, data: any) => {
    try {
      res.write(`event: ${ev}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      // ignore
    }
  };

  sendEvent('log', { step: 'Received Prompt', message: prompt, timestamp: new Date().toISOString() });

  sendEvent('log', { step: 'Searching', message: 'Performing web search for grounding...', timestamp: new Date().toISOString() });
  const searchResults = await webSearch(prompt, searchKey);
  sendEvent('log', { step: 'Search Results', message: JSON.stringify(searchResults.slice(0,3)), timestamp: new Date().toISOString() });

  if (!openaiKey) {
    sendEvent('error', { message: 'OpenAI API key missing' });
    sendEvent('done', {});
    return res.end();
  }

  try {
    sendEvent('log', { step: 'Generating LinkedIn', message: 'Calling model for LinkedIn post', timestamp: new Date().toISOString() });
    const linkedin = await generateLinkedInText(prompt, openaiKey, searchResults, 'You are a helpful assistant that writes social media posts.');
    sendEvent('linkedin', { text: linkedin });
    sendEvent('log', { step: 'LinkedIn Complete', message: 'LinkedIn post generated', timestamp: new Date().toISOString() });

    sendEvent('log', { step: 'Generating X', message: 'Calling model for X/Twitter post', timestamp: new Date().toISOString() });
    const x = await generateXText(prompt, openaiKey, searchResults, 'You are a helpful assistant that writes social media posts.');
    sendEvent('x', { text: x });
    sendEvent('log', { step: 'X Complete', message: 'X post generated', timestamp: new Date().toISOString() });

    sendEvent('done', { linkedin: linkedin, x: x });
  } catch (err: any) {
    sendEvent('error', { message: String(err?.message || err) });
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});
