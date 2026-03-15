# FB Sales AI Assistant

## Overview

A full-stack platform that helps Facebook page owners automatically respond to product inquiries using AI. The AI acts as a human sales assistant, answering questions about price, colors, stock, delivery, etc., and guides users toward purchasing.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui components
- **AI**: OpenAI via Replit AI Integrations (gpt-5-mini)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (routes, AI service)
│   └── dashboard/          # React + Vite frontend dashboard
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/
│           ├── products.ts
│           ├── conversations.ts
│           └── messages.ts
├── scripts/
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Key Features

- **Product Management**: Add products with name, price, colors, stock, description, Facebook post URL/ID, custom attributes
- **AI Conversations**: AI automatically responds to user messages in the same language (Arabic, French, English, etc.)
- **Conversation Dashboard**: Three tabs — Confirmed, In Progress, Manual Intervention
- **AI/Manual Toggle**: Per-conversation mode switch with automatic escalation
- **Facebook Webhook**: Ready for `/api/webhook/facebook` integration
- **Simulate endpoint**: `POST /api/simulate/message` for testing without Facebook

## Database Schema

### products
- id, name, facebookPostUrl, facebookPostId, price (numeric), colors, stock, description, attributes, isActive, createdAt, updatedAt

### conversations  
- id, productId (FK), fbUserId, fbUserName, mode (ai|manual), status (in_progress|confirmed|manual_intervention), createdAt, updatedAt

### messages
- id, conversationId (FK), role (user|assistant|system), content, source (facebook|manual|ai|simulated), fbMessageId, createdAt

## API Routes

- `GET/POST /api/products` — list/create products
- `GET/PATCH/DELETE /api/products/:id` — product CRUD
- `GET /api/conversations?tab=&productId=` — list conversations
- `GET /api/conversations/:id` — get conversation with messages
- `PATCH /api/conversations/:id` — update mode/status
- `POST /api/conversations/:id/messages` — send manual message
- `POST /api/conversations/:id/ai-reply` — trigger AI reply
- `GET/POST /api/webhook/facebook` — Facebook webhook
- `POST /api/simulate/message` — simulate user message (testing)

## AI Behavior

Located in `artifacts/api-server/src/lib/ai.ts`:
- Uses `gpt-5-mini` via Replit AI Integrations
- Builds system prompt from product context
- Responds in the customer's language
- Auto-escalates to manual mode if negotiation keywords detected

## Environment Variables

- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Replit AI proxy URL (auto-set)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Replit AI key (auto-set)
- `DATABASE_URL`, `PGHOST`, etc. — PostgreSQL (auto-set)
- `FB_WEBHOOK_VERIFY_TOKEN` — Facebook webhook verify token (optional, defaults to "fb_verify_token_123")

## Frontend Pages

- `/` — Conversations dashboard with tabs and product filter
- `/conversations/:id` — Conversation detail with chat UI, AI/Manual toggle, product info
- `/products` — Product management (CRUD)
- `/simulate` — Test AI without Facebook

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. Always typecheck from root: `pnpm run typecheck`.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively builds all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes
