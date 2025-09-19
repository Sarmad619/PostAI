import axios from "axios";

export async function webSearch(query: string, apiKey?: string) {
  // Lightweight placeholder: if no search API key, return a simple simulated result.
  if (!apiKey) {
    return [
      { title: "Placeholder result for " + query, snippet: "No search key provided; using placeholder context." }
    ];
  }

  // Example for Bing Web Search API (user must set SEARCH_API_KEY)
  try {
    const resp = await axios.get("https://api.bing.microsoft.com/v7.0/search", {
      params: { q: query, count: 3 },
      headers: { "Ocp-Apim-Subscription-Key": apiKey }
    });
    const webPages = resp.data.webPages?.value || [];
    return webPages.map((w: any) => ({ title: w.name, snippet: w.snippet, url: w.url }));
  } catch (err) {
    return [{ title: "Search failed", snippet: "Search API error or network issue." }];
  }
}
