# cvMaker

Role-specific CV tailoring app with a premium React frontend and a TypeScript backend that:

- accepts an uploaded PDF CV
- asks for the target role
- rewrites the CV into sharper achievement statements
- generates a polished one-page PDF for download

## Structure

- `apps/web`: React + TypeScript + Vite frontend
- `apps/api`: Express + TypeScript backend

## Development

```bash
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:8787`

## Environment

Create `apps/api/.env` if you want to enable AI-assisted rewriting:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
```

Without an API key, the app still works using the built-in deterministic rewrite engine.
