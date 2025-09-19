import { AgentLogEntry, GenerateResponse } from "./types";
import { webSearch } from "./websearch";
import OpenAI from "openai";

function now() { return new Date().toISOString(); }

// Shared instruction builder so all endpoints use the same prompt templates
export function makeInstructions(searchResults: any[]) {
  const system = `You are a helpful assistant that writes social media posts. Use the user prompt and the provided context from web search. Return strictly the LinkedIn post and X post.`;
  const linkedinInstruction = `Write a professional LinkedIn post (250-300 words) with a clear structure, hashtags, and a call-to-action. Use the following context:\n${searchResults.map((r:any)=>r.title+": "+(r.snippet||'')).join('\n')}`;
  const xInstruction = `Write a casual X/Twitter post under 280 characters that summarizes the idea and includes one or two hashtags.`;
  return { system, linkedinInstruction, xInstruction };
}

export async function generatePosts(prompt: string, openaiKey: string | undefined, searchKey: string | undefined): Promise<GenerateResponse> {
  const log: AgentLogEntry[] = [];

  log.push({ step: "Received Prompt", message: prompt, timestamp: now() });

  log.push({ step: "Searching", message: "Performing web search for grounding...", timestamp: now() });
  const searchResults = await webSearch(prompt, searchKey);
  log.push({ step: "Search Results", message: JSON.stringify(searchResults.slice(0,3)), timestamp: now() });

  if (!openaiKey) {
    log.push({ step: "Error", message: "OpenAI API key missing", timestamp: now() });
    return { linkedin: "", x: "", log };
  }

  const client = new OpenAI({ apiKey: openaiKey });

  log.push({ step: "Drafting", message: "Composing prompts for OpenAI model...", timestamp: now() });

  const { system, linkedinInstruction, xInstruction } = makeInstructions(searchResults);
  const userMessage = `User prompt: ${prompt}\n\nLinkedIn instruction:\n${linkedinInstruction}\n\nX instruction:\n${xInstruction}`;

  try {
    // Use helper functions to generate each post deterministically
  // Limit context size to first 5 search results
  const limitedSearch = Array.isArray(searchResults) ? searchResults.slice(0,5) : [];
  const linkedInText = await generateLinkedInText(prompt, openaiKey, limitedSearch, system);
    log.push({ step: "LinkedIn Complete", message: linkedInText ? 'LinkedIn post generated' : 'LinkedIn generation returned empty', timestamp: now() });

  const xText = await generateXText(prompt, openaiKey, limitedSearch, system);
    log.push({ step: "X Complete", message: xText ? 'X post generated' : 'X generation returned empty', timestamp: now() });

    log.push({ step: "Finalizing", message: "Generated both posts", timestamp: now() });
    return { linkedin: linkedInText, x: xText, log };
  } catch (err: any) {
    log.push({ step: "Error", message: String(err?.message || err), timestamp: now() });
    return { linkedin: "", x: "", log };
  }
}

// Helper to extract text content from SDK response shapes
const extractText = (resp: any) => {
  const choice = resp?.choices?.[0];
  if (!choice) return '';
  const msg = choice.message;
  if (msg) {
    const content = msg.content;
    if (Array.isArray(content)) {
      const first = content.find((c: any) => typeof c?.text === 'string') || content[0];
      return first?.text ?? '';
    } else if (typeof content === 'string') {
      return content;
    }
  }
  if (typeof choice.text === 'string') return choice.text;
  return '';
};

export async function generateLinkedInText(prompt: string, openaiKey: string | undefined, searchResults: any[], systemPrompt: string) {
  const cfg = new OpenAI({ apiKey: openaiKey });
  // Safety: limit prompt length
  if (prompt.length > 1000) throw new Error('Prompt too long');
  // Basic profanity check (very small list)
  const profane = ['fuck','shit','bitch'];
  const lowered = prompt.toLowerCase();
  if (profane.some(p=>lowered.includes(p))) throw new Error('Prompt contains disallowed language');
  const { linkedinInstruction } = makeInstructions(searchResults);
  // Ask the model to return a JSON object with a `linkedin` field only.
  const jsonPrompt = `${linkedinInstruction}\n\nIMPORTANT: Return ONLY valid JSON with a single key \"linkedin\" whose value is the post string. Do not include any extra text or explanation.`;

  const resp: any = await cfg.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `User prompt: ${prompt}\n\n${jsonPrompt}` }
    ],
    max_tokens: 800
  });

  // First try to parse strict JSON from the response
  let text = '';
  try {
    const raw = extractText(resp).trim();
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.linkedin === 'string') {
      text = parsed.linkedin.trim();
    } else {
      // fallback to raw text
      text = raw;
    }
  } catch {
    // fallback to raw extraction
    text = extractText(resp).trim();
  }

  // 1) If the model appended a labeled X/Twitter section, strip from common headings
  const headingRegex = /\n\s*(?:X[:\-]|X\/Twitter|Twitter[:\-]|Twitter post[:\-]|X post[:\-]|Twitter\/X[:\-]|—\s*X)\b[\s\S]*$/i;
  if (headingRegex.test(text)) {
    text = text.replace(headingRegex, '').trim();
    return text;
  }

  // 2) If the output contains two large blocks separated by blank line(s), and the last block is short
  // and looks like a social tweet (<=280 chars and contains a hashtag or url or short length), remove it
  const blocks = text.split(/\n\s*\n/).map((b: string) => b.trim()).filter(Boolean);
  if (blocks.length >= 2) {
    const lastBlock = blocks[blocks.length - 1];
    const looksLikeTweet = lastBlock.length <= 300 && (/#|https?:\/\//i.test(lastBlock) || lastBlock.split(/[.?!]/).length <= 2);
    if (looksLikeTweet) {
      return blocks.slice(0, -1).join('\n\n').trim();
    }
  }

  // 3) Fallback: if the entire text is under 300 chars it's probably not a LinkedIn long post; return as-is
  // 3) Fallback: if the entire text is under 300 chars it's probably not a LinkedIn long post; return as-is
  return text;
}

export async function generateXText(prompt: string, openaiKey: string | undefined, searchResults: any[], systemPrompt: string) {
  const cfg = new OpenAI({ apiKey: openaiKey });
  const { xInstruction } = makeInstructions(searchResults);
  // Ask model to return JSON with `x` key
  const jsonPrompt = `${xInstruction}\n\nIMPORTANT: Return ONLY valid JSON with a single key \"x\" whose value is the post string under 280 characters.`;
  const resp: any = await cfg.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `User prompt: ${prompt}\n\n${jsonPrompt}` }
    ],
    max_tokens: 200
  });

  let text = '';
  try {
    const raw = extractText(resp).trim();
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.x === 'string') text = parsed.x.trim(); else text = raw;
  } catch {
    text = extractText(resp).trim();
  }
  return text;
}

