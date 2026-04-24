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

/** Single-quote escape a string for safe use in sh -c '...' */
function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''" ) + "'";
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "search_web",
    label: "Search Web",
    description:
      "Search the web using the Tavily API. Returns relevant search results with titles, URLs, and content snippets. Useful for finding current information, recent events, documentation, or any web-based knowledge.",
    promptSnippet: "Search the web for current information via Tavily",
    promptGuidelines: [
      "Use search_web when the user asks about current events, recent information, or anything that may not be in training data.",
      "Use search_web to look up documentation, APIs, or technical references that may have changed.",
      "Prefer search_web with search_depth 'basic' for simple factual queries, and 'advanced' for complex research.",
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
      onUpdate?.({
        content: [{ type: "text", text: `Searching: ${params.query}` }],
      });

      const body: Record<string, unknown> = {
        query: params.query,
        search_depth: params.search_depth ?? "basic",
        max_results: params.max_results ?? 5,
        include_answer: params.include_answer ?? true,
      };

      const jsonBody = JSON.stringify(body);

      // Build the curl command — uses $TAVILY_API_KEY which will be in the env
      const curlCmd = `curl -s -f -X POST "https://api.tavily.com/search" `
        + `-H "Content-Type: application/json" `
        + `-H "Authorization: Bearer $TAVILY_API_KEY" `
        + `-d ${shellEscape(jsonBody)}`;

      // Try psst first (secret never enters agent context), fall back to env var
      let cmd: string;
      let psstFlag = "";
      const hasPsst = await (async () => {
        try {
          const which = await pi.exec("sh", ["-c", "command -v psst"], { signal, timeout: 3000 });
          if (which.exitCode !== 0) return false;
          // Check local vault first, then global
          const local = await pi.exec("sh", ["-c", "psst list --json --quiet 2>/dev/null"], { signal, timeout: 5000 });
          if (local.stdout.includes("TAVILY_API_KEY")) return true;
          const global = await pi.exec("sh", ["-c", "psst --global list --json --quiet 2>/dev/null"], { signal, timeout: 5000 });
          if (global.stdout.includes("TAVILY_API_KEY")) { psstFlag = "--global "; return true; }
          return false;
        } catch { return false; }
      })();

      if (hasPsst) {
        cmd = `psst ${psstFlag}TAVILY_API_KEY -- sh -c ${shellEscape(curlCmd)}`;
      } else if (process.env.TAVILY_API_KEY) {
        cmd = curlCmd;
      } else {
        // Last resort: check if the shell environment has it (e.g. pi injects psst secrets)
        const envCheck = await pi.exec("sh", ["-c", "echo $TAVILY_API_KEY"], { signal, timeout: 5000 });
        if (!envCheck.stdout.trim()) {
          throw new Error(
            "TAVILY_API_KEY not found. Install psst (npm i -g psst-cli) and run `psst set TAVILY_API_KEY`, or set the environment variable. Get a key at https://tavily.com/"
          );
        }
        cmd = curlCmd;
      }

      const result = await pi.exec("sh", ["-c", cmd], { signal, timeout: 30000 });

      if (result.exitCode !== 0) {
        throw new Error(
          `Tavily API request failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`
        );
      }

      let data: TavilyResponse;
      try {
        data = JSON.parse(result.stdout) as TavilyResponse;
      } catch {
        throw new Error(`Failed to parse Tavily response: ${result.stdout.slice(0, 500)}`);
      }

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
