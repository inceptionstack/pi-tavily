import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateHead, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@mariozechner/pi-ai";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content?: string | null;
}

interface TavilyResponse {
  query: string;
  answer?: string;
  results: TavilyResult[];
  response_time: string;
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "tavily_web_search",
    label: "Tavily Web Search",
    description:
      "Search the web using the Tavily API. Returns relevant search results with titles, URLs, and content snippets. Useful for finding current information, recent events, documentation, or any web-based knowledge.",
    promptSnippet: "Search the web for current information via Tavily",
    promptGuidelines: [
      "Use tavily_web_search when the user asks about current events, recent information, or anything that may not be in training data.",
      "Use tavily_web_search to look up documentation, APIs, or technical references that may have changed.",
      "Prefer tavily_web_search with search_depth 'basic' for simple factual queries, and 'advanced' for complex research.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "The search query to execute" }),
      search_depth: Type.Optional(
        StringEnum(["basic", "advanced"] as const, {
          description: "Search depth: 'basic' for fast results, 'advanced' for thorough search. Default: basic",
        })
      ),
      max_results: Type.Optional(
        Type.Number({
          description: "Maximum number of results to return (1-20). Default: 5",
          minimum: 1,
          maximum: 20,
        })
      ),
      include_answer: Type.Optional(
        Type.Boolean({
          description: "Include a short AI-generated answer. Default: true",
        })
      ),
    }),

    async execute(_toolCallId, params, signal, onUpdate) {
      // Check process.env first, then fall back to reading from shell
      // (psst secrets may only be injected into shell subprocesses)
      let apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) {
        const result = await pi.exec("sh", ["-c", "echo $TAVILY_API_KEY"], { signal, timeout: 5000 });
        apiKey = result.stdout.trim();
      }
      if (!apiKey) {
        throw new Error(
          "TAVILY_API_KEY environment variable is not set. Get one at https://tavily.com/"
        );
      }

      onUpdate?.({
        content: [{ type: "text", text: `Searching: ${params.query}` }],
      });

      const body: Record<string, unknown> = {
        query: params.query,
        search_depth: params.search_depth ?? "basic",
        max_results: params.max_results ?? 5,
        include_answer: params.include_answer ?? true,
      };

      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `Tavily API error (${response.status}): ${errorText || response.statusText}`
        );
      }

      const data = (await response.json()) as TavilyResponse;

      // Format results for the LLM
      let output = "";

      if (data.answer) {
        output += `## Answer\n${data.answer}\n\n`;
      }

      output += `## Search Results (${data.results.length} results, ${data.response_time}s)\n\n`;

      for (const result of data.results) {
        output += `### ${result.title}\n`;
        output += `URL: ${result.url}\n`;
        output += `Relevance: ${(result.score * 100).toFixed(1)}%\n`;
        output += `${result.content}\n\n`;
      }

      // Truncate if needed
      const truncation = truncateHead(output, {
        maxLines: DEFAULT_MAX_LINES,
        maxBytes: DEFAULT_MAX_BYTES,
      });

      let text = truncation.content;
      if (truncation.truncated) {
        text += `\n\n[Output truncated: ${truncation.outputLines} of ${truncation.totalLines} lines`;
        text += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)})]`;
      }

      return {
        content: [{ type: "text", text }],
        details: {
          query: data.query,
          resultCount: data.results.length,
          responseTime: data.response_time,
          hasAnswer: !!data.answer,
        },
      };
    },
  });
}
