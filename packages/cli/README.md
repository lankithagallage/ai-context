# @lankithagallage/ai-context-cli

Command-line interface for [ai-context](https://github.com/lankithagallage/ai-context) —
git-versioned, cross-AI context memory for AI-assisted codebases.

## Usage

```bash
# Initialise the store in your project
npx @lankithagallage/ai-context-cli init

# Capture a transcript manually
npx @lankithagallage/ai-context-cli capture --tool claude-code --file path/to/transcript.jsonl

# Recall relevant context for a task
npx @lankithagallage/ai-context-cli recall "what did we decide about the auth flow?"

# Check store health
npx @lankithagallage/ai-context-cli status

# Rebuild the vector index from markdown artifacts
npx @lankithagallage/ai-context-cli index
```

## Requirements

- Node.js 20+
- [Ollama](https://ollama.com) running locally (`ollama pull llama3.1:8b`)

For auto-capture on session end, see
[@lankithagallage/ai-context-adapter-claude-code](https://www.npmjs.com/package/@lankithagallage/ai-context-adapter-claude-code).
