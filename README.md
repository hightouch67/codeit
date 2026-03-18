# CodeIt — AI-Powered React Native App Builder

## Architecture

```
codeit/
├── app/                    # Expo React Native boilerplate
│   ├── app/               # Expo Router pages
│   ├── components/        # Reusable components (ChatWidget)
│   ├── screens/           # Screen components
│   ├── hooks/             # Custom hooks (useTheme, useWebSocket)
│   ├── services/          # API client
│   ├── theme/             # Colors, spacing, typography
│   └── utils/             # Config, helpers
├── server/                # Backend orchestrator
│   └── src/
│       ├── ai/            # AI prompt builder, execution, retry
│       ├── config/        # Environment, safety rules
│       ├── controllers/   # REST API routes
│       ├── git/           # Git service (clone, branch, commit, push)
│       ├── middleware/     # WebSocket manager
│       ├── queue/         # In-memory job queue
│       ├── services/      # Patch applier, container runner, job processor
│       ├── types/         # TypeScript types
│       └── validators/    # Zod schemas, file path security
├── shared/                # Shared types between client & server
├── infra/docker/          # Workspace Dockerfile
├── Dockerfile             # Server production image
├── docker-compose.yml     # Full stack docker setup
└── docs/                  # Example AI interactions
```

## Quick Start

### 1. Install dependencies

```bash
# Server
cd server && npm install

# App
cd ../app && npm install
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
# Edit server/.env with your AI endpoint and GitHub token
```

### 3. Start the server

```bash
cd server && npm run dev
```

### 4. Start the Expo app

```bash
cd app && npx expo start
```

## Workflow

1. User opens the app and taps the chat bubble
2. Types a prompt describing desired changes
3. Backend queues a job and streams status via WebSocket
4. AI generates targeted file operations (create/update/delete)
5. Operations are validated for security (path whitelist, no env modification)
6. Patches are applied to the user's repo
7. TypeScript validation runs (optionally in Docker container)
8. Changes are committed and pushed to Git
9. Status streamed back to the client in real-time

## Safety Model

- **File path whitelist**: Only `components/`, `screens/`, `hooks/`, `services/`, `navigation/`, `theme/`, `utils/`, `app/`, `assets/`, `lib/`, `src/` are writable
- **Blocked files**: `.env*`, `package-lock.json`, `node_modules/`
- **No shell execution**: AI output is never executed as shell commands
- **Patch-only**: Updates use unified diffs, not blind overwrites
- **Path traversal protection**: `..` and absolute paths are blocked
- **Container isolation**: Validation runs in memory/CPU-limited ephemeral containers

## Docker

### Build workspace image
```bash
docker build -t codeit-workspace:latest -f infra/docker/Dockerfile.workspace .
```

### Run full stack
```bash
docker-compose up -d
```

## AI Contract

The AI must return JSON matching this schema:

```json
{
  "operations": [
    {
      "type": "create_file | update_file | delete_file",
      "path": "relative/path/to/file.ts",
      "content": "full content (create_file)",
      "diff": "unified diff (update_file)"
    }
  ],
  "summary": "description of changes",
  "reasoning": "optional explanation"
}
```

See `docs/example-ai-interaction.json` for a full example.
