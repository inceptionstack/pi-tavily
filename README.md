# pi-tavily

A [pi](https://github.com/badlogic/pi-mono) extension that adds a `web_search` tool powered by the [Tavily Search API](https://tavily.com/).

## Setup

1. Get a Tavily API key from [tavily.com](https://tavily.com/)
2. Provide the key via **one** of these methods (checked in order):

### Option A: psst (recommended)

If [psst](https://github.com/Michaelliv/psst) is installed, the extension will automatically use it. The secret never enters the agent's context.

```bash
npm install -g psst-cli
psst init
psst set TAVILY_API_KEY
```

### Option B: Environment variable

```bash
export TAVILY_API_KEY=tvly-YOUR_API_KEY
```

### Resolution order

1. **psst vault** — if `psst` CLI is available and `TAVILY_API_KEY` is in the vault, the request is executed via `psst TAVILY_API_KEY -- curl ...` so the key is never exposed to the agent.
2. **`process.env.TAVILY_API_KEY`** — direct environment variable.
3. **Shell environment** — falls back to checking the shell (covers pi's own psst secret injection).

## Installation

### As a pi package

```bash
pi install /path/to/pi-tavily
```

### Quick test

```bash
pi -e /path/to/pi-tavily
```

### Global extension

Copy or symlink to `~/.pi/agent/extensions/pi-tavily/`.

## Usage

Once loaded, the LLM can call the `search_web` tool to search the web for current information.

### Parameters

| Parameter       | Type     | Required | Default   | Description                                                                 |
|-----------------|----------|----------|-----------|-----------------------------------------------------------------------------|
| `query`         | string   | yes      |           | The search query                                                            |
| `search_depth`  | string   | no       | `basic`   | `"basic"` for fast results, `"advanced"` for more thorough search           |
| `max_results`   | number   | no       | `5`       | Maximum number of results to return (1–20)                                  |
| `include_answer` | boolean | no       | `true`    | Include a short AI-generated answer                                         |

### Example

```
Search the web for the latest news about TypeScript 6.0
```

The LLM will call `search_web` with an appropriate query and incorporate the results into its response.

## License

MIT
