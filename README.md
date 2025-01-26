# Ollama Chat with RAG

A lightweight chat application that integrates with local Ollama LLMs and implements a RAG (Retrieval-Augmented Generation) system using pgvector.

## Features

- Chat with local Ollama models
- Automatic model detection
- Conversation history persistence
- RAG system using pgvector for context-aware responses

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 15+ with pgvector extension
- Ollama running locally with deepseek-r1 model installed

## Installation

1. Install Ollama:
   - Mac: `brew install ollama`
   - Linux: `curl -fsSL https://ollama.com/install.sh | sh`
   - Windows: Download from [Ollama.com](https://ollama.com)

2. Pull and run the deepseek-r1 model:
```bash
ollama pull deepseek-r1
```

3. Install dependencies:
```bash
npm install
```

4. Set up PostgreSQL:
   - Install PostgreSQL 15 or later
   - Install pgvector extension:
     ```sql
     CREATE EXTENSION vector;
     ```
   - Create a database named 'ollama_chat'

5. Configure environment:
   - Copy `.env.example` to `.env`
   - Update the `POSTGRES_URL` if needed

6. Run database migrations:
```bash
psql -d ollama_chat -f src/lib/db/migrations/001_initial.sql
```

## Running the Application

1. Start Ollama (if not already running, pretty sure on mac it is by default):
```bash
ollama serve
```

2. Start the development server:
```bash
npm run dev
```

The application will be available at http://localhost:3000

## Usage

1. Open the application in your browser
2. Select the "deepseek-r1" model from the dropdown
3. Start chatting!

## Troubleshooting

- If Ollama is not responding, ensure it's running with `ollama serve`
- If the model is not available, run `ollama pull deepseek-r1`
- Check Ollama logs for any errors: `ollama logs`

## Model Information

The deepseek-r1 model is a powerful language model that:
- Excels at reasoning and step-by-step thinking
- Shows its thought process in blue bubbles using `<think>` tags
- Provides clear, structured responses
- Supports markdown formatting

## License

MIT

## Development

- `src/app/page.tsx` - Main chat interface
- `src/app/api/*` - API routes for chat and model management
- `src/lib/db/*` - Database configuration and migrations
