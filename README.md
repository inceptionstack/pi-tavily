# pi-tavily

A [pi](https://github.com/badlogic/pi-mono) extension that adds a `web_search` tool powered by the [Tavily Search API](https://tavily.com/).

## Setup

1. Get a Tavily API key from [tavily.com](https://tavily.com/)
2. Set the `TAVILY_API_KEY` environment variable:
   ```bash
   export TAVILY_API_KEY=tvly-YOUR_API_KEY
   ```

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

Once loaded, the LLM can call the `web_search` tool to search the web for current information.

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

The LLM will call `web_search` with an appropriate query and incorporate the results into its response.

## License

MIT
