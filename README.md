# BLG Analysis Backend

A NestJS API that checks how visible your brand is in AI tools like Gemini and ChatGPT.

Give it a website URL - it crawls the site, figures out the brand, asks both Gemini and ChatGPT relevant questions in parallel, and shows you how often your brand gets recommended. Results stream in real time via SSE.

## How It Works

1. Crawls the website using Jina Reader
2. Sends the content to Gemini to understand the brand and create search prompts
3. Runs those prompts through both Gemini and ChatGPT in parallel
4. Extracts brand mentions from each response
5. Streams progress updates and final scores via SSE

## Setup

### What You Need

- Node.js 24+
- Three Gemini API keys ([get one here](https://aistudio.google.com/apikey))
- An OpenAI API key ([get one here](https://platform.openai.com/api-keys))
- A Jina API key ([get one here](https://jina.ai/reader))

### Install

```bash
npm install
```

### Environment Variables

Copy the example file and fill in your keys:

```bash
cp .env.example .env
```

Then edit `.env`:

```
PORT=3000
GEMINI_PROMPT_API_KEY=your_gemini_prompt_key
GEMINI_QUERY_API_KEY=your_gemini_query_key
GEMINI_SCORING_API_KEY=your_gemini_scoring_key
OPENAI_QUERY_API_KEY=your_openai_key
JINA_API_KEY=your_jina_key
JINA_BASE_URL=https://r.jina.ai
RATE_LIMIT_MAX_CALLS=3
```

Three separate Gemini keys are used to spread requests across free-tier rate limits - one for prompt generation, one for search queries, and one for scoring.

### Run

```bash
npm run start:dev

npm run build
npm run start:prod
```

### Run with Docker

```bash
docker compose up --build
```

## Rate Limiting

Each IP gets a limited number of lifetime requests (default: 3). After that the API returns `429 Too Many Requests`. Change the limit with `RATE_LIMIT_MAX_CALLS` in `.env`.

## API

See [API.md](API.md) for full details.

## Scripts

| Command              | What it does                 |
| -------------------- | ---------------------------- |
| `npm run start:dev`  | Start in dev mode with watch |
| `npm run build`      | Build for production         |
| `npm run start:prod` | Run the production build     |
| `npm run lint`       | Lint and auto-fix            |
| `npm run format`     | Format code with Prettier    |
| `npm test`           | Run tests                    |
