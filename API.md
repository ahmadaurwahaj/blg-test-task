# API Documentation

Base URL: `http://localhost:3000`

---

## Analyze Website

Check how visible a brand is when people ask AI tools like Gemini and ChatGPT for recommendations.

Send a website URL. The API crawls the site, creates search prompts, queries both Gemini and ChatGPT in parallel, and streams the results back as Server-Sent Events (SSE).

### Rate Limiting

Each IP address gets **3 lifetime requests**. After that the endpoint returns `429 Too Many Requests`. Configure via `RATE_LIMIT_MAX_CALLS` in `.env`.

### Request

```
POST /analyze
Content-Type: application/json
```

**Body:**

```json
{
  "url": "https://example.com"
}
```

| Field | Type   | Required | Info                |
| ----- | ------ | -------- | ------------------- |
| url   | string | yes      | Must be a valid URL |

---

### Response (SSE Stream)

**Status:** `200 OK`
**Content-Type:** `text/event-stream`

The response is a stream of SSE events. Each line starts with `data: ` followed by a JSON object.

#### Event Types

**Progress events:**

```
data: {"type":"progress","stage":"Crawling website"}

data: {"type":"progress","stage":"Crawling done"}

data: {"type":"progress","stage":"Generating relevant prompts"}

data: {"type":"progress","stage":"Prompts generated (5 prompts)"}

data: {"type":"progress","stage":"Querying Gemini & ChatGPT for prompt 1/5"}

data: {"type":"progress","stage":"Calculating scores"}
```

**Result event:**

```json
{
  "type": "result",
  "data": {
    "overallVisibilityScore": 50,
    "comparison": {
      "gemini": { "visibilityScore": 60, "marketShare": 18.5 },
      "chatgpt": { "visibilityScore": 40, "marketShare": 12.3 }
    },
    "totalPromptsAnalyzed": 10,
    "gemini": {
      "llm": "gemini",
      "visibilityScore": 60,
      "marketShare": 18.5,
      "totalPrompts": 5,
      "promptsWithBrand": 3,
      "brandRanking": [{ "name": "some brand", "mentions": 12, "share": 35.2 }],
      "citationDomains": [{ "domain": "example.com", "count": 4 }],
      "perPromptResults": [
        {
          "query": "best tools for small business websites",
          "stage": "awareness",
          "response": "Here are some popular options...",
          "citations": [
            {
              "url": "https://example.com/page",
              "title": "Page Title",
              "domain": "example.com"
            }
          ],
          "brands": [
            {
              "name": "some brand",
              "mentions": 3,
              "context": "mentioned as a top pick"
            }
          ],
          "targetBrandFound": true,
          "targetBrandMentions": 2
        }
      ]
    },
    "chatgpt": {
      "llm": "chatgpt",
      "visibilityScore": 40,
      "marketShare": 12.3,
      "totalPrompts": 5,
      "promptsWithBrand": 2,
      "brandRanking": [{ "name": "some brand", "mentions": 8, "share": 28.1 }],
      "citationDomains": [{ "domain": "example.com", "count": 3 }],
      "perPromptResults": []
    },
    "combinedBrandRanking": [
      { "name": "some brand", "mentions": 20, "share": 32.0 },
      { "name": "another brand", "mentions": 15, "share": 24.0 }
    ],
    "combinedCitationDomains": [
      { "domain": "example.com", "count": 7 },
      { "domain": "other.com", "count": 3 }
    ]
  }
}
```

**Error event:**

```
data: {"type":"error","message":"Failed to generate analysis prompts"}
```

---

#### Top-level

| Field                  | Info                                                       |
| ---------------------- | ---------------------------------------------------------- |
| overallVisibilityScore | Average score across both LLMs (0-100)                     |
| comparison             | Gemini vs ChatGPT visibility and market share side by side |
| totalPromptsAnalyzed   | Total prompts run across both LLMs                         |

#### Per-LLM (`gemini` / `chatgpt`)

| Field            | Info                                                    |
| ---------------- | ------------------------------------------------------- |
| llm              | Which LLM this data is from (`gemini` or `chatgpt`)     |
| visibilityScore  | Percentage of prompts where the brand showed up (0-100) |
| marketShare      | Brand mentions as a share of all brands mentioned       |
| totalPrompts     | How many prompts were tested                            |
| promptsWithBrand | How many of those prompts included the brand            |
| brandRanking     | All brands found, sorted by most mentions               |
| citationDomains  | Domains used as sources, with counts                    |
| perPromptResults | Full details for each prompt                            |

#### Combined

| Field                   | Info                                        |
| ----------------------- | ------------------------------------------- |
| combinedBrandRanking    | All brands from both LLMs merged and sorted |
| combinedCitationDomains | All citation domains from both LLMs merged  |

---

### Error Responses

**400 Bad Request - invalid or missing URL:**

```json
{
  "message": ["url must be a URL address"],
  "error": "Bad Request",
  "statusCode": 400
}
```

**429 Too Many Requests - IP has used all free calls:**

```json
{
  "message": "Rate limit exceeded. You have used all 3 free analysis calls.",
  "error": "Too Many Requests",
  "statusCode": 429
}
```

**500 Internal Server Error:**

```json
{
  "message": "Failed to generate analysis prompts",
  "statusCode": 500
}
```

**404 Not Found:**

```json
{
  "message": "Cannot GET /wrong-path",
  "error": "Not Found",
  "statusCode": 404
}
```
