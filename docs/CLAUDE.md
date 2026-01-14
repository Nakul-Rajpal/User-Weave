# Bolt.DIY Architecture Guide

## Overview

Bolt.DIY is an AI-powered web development IDE built with modern web technologies. It combines a Remix-based web framework with WebContainer for sandboxed code execution, multiple AI provider support, and persistent storage via Supabase.

**Key Technologies:**
- Remix (Full-stack React framework with Cloudflare Pages)
- WebContainer API (StackBlitz's sandboxed runtime)
- Nanostores + Zustand (State management)
- Supabase (Auth & Database)
- CodeMirror (Code editor)
- Vite (Build tool)
- Electron support (for desktop builds)

## IMPORTANT POINT:

# Original Repo
- https://github.com/stackblitz-labs/bolt.diy
- follow this github repo for the original code which is for single user and works properly

---

## 1. Main Application Structure

### Directory Layout

```
app/
├── routes/           # Remix file-based routing
│   ├── _index.tsx    # Home page
│   ├── chat.$id.tsx  # Chat interface for specific chat
│   ├── $.tsx         # Catch-all route
│   └── api.*.ts      # Server-side API endpoints
├── components/       # React components
│   ├── chat/        # Chat interface components
│   ├── editor/      # Code editor components
│   ├── workbench/   # Workbench/IDE components
│   ├── @settings/   # Settings panel
│   └── auth/        # Authentication components
├── lib/             # Core business logic
│   ├── stores/      # Nanostores & Zustand stores
│   ├── modules/     # LLM provider management
│   ├── persistence/ # Database & storage layer
│   ├── webcontainer/ # WebContainer initialization
│   ├── supabase/    # Supabase integration
│   ├── runtime/     # Message parsing & action execution
│   ├── hooks/       # Custom React hooks
│   └── .server/     # Server-only code (not bundled for client)
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── styles/          # SCSS stylesheets
```

### Remix Configuration

**Entry Points:**
- `entry.server.tsx` - Server-side rendering with RemixServer and renderToReadableStream
- `entry.client.tsx` - Client hydration with RemixBrowser
- `root.tsx` - Main layout component with auth provider and DnD setup

**Deployment:**
- Runs on Cloudflare Pages via Wrangler
- Uses `@remix-run/cloudflare` for edge runtime support
- Streaming responses for chat API

---

## 2. AI Provider Integration & Management

### LLM Provider System

**Architecture:**
- **LLMManager** (`lib/modules/llm/manager.ts`) - Singleton pattern managing all providers
- **BaseProvider** (`lib/modules/llm/base-provider.ts`) - Abstract base for all providers
- **Registry Pattern** - Providers auto-register at startup

**Supported Providers:**
- OpenAI (@ai-sdk/openai)
- Anthropic (@ai-sdk/anthropic)
- Google (Gemini)
- OpenRouter (@openrouter/ai-sdk-provider)
- Ollama (Local)
- LM Studio (Local)
- Together AI
- OpenAI-compatible services

### Model Management

**Static Models:**
- Defined by provider (e.g., Claude 3.5 Sonnet, GPT-4o)
- Always available, no API keys needed for listing

**Dynamic Models:**
- Fetched from provider APIs with API keys
- Cached based on cache key (api key + settings hash)
- Examples: Ollama's available local models, OpenAI's fine-tuned models

### Provider Settings Flow

```
User Input (API Keys) 
  ↓
Settings Store (Zustand + localStorage)
  ↓
Cookies (for server-side requests)
  ↓
Server API (LLM Manager)
  ↓
Provider Instance Creation
  ↓
AI SDK (Vercel ai package)
```

**Key Files:**
- `lib/stores/settings.ts` - Provider settings, auto-enable from environment
- `lib/modules/llm/providers/*.ts` - Individual provider implementations
- `app/routes/api.models.ts` - Endpoint to fetch available models
- `app/routes/api.llmcall.ts` - Direct LLM calls

---

## 3. WebContainer Integration

### WebContainer Initialization

**Location:** `lib/webcontainer/index.ts`

**Lifecycle:**
1. Boots with `WebContainer.boot()` on client-side only
2. Persists across hot module reloads via `import.meta.hot.data`
3. Sets up preview script for error forwarding
4. Listens for uncaught exceptions and unhandled rejections

**Key Configuration:**
```typescript
WebContainer.boot({
  coep: 'credentialless',  // For cross-origin embedding
  workdirName: 'project',   // Root working directory
  forwardPreviewErrors: true // Error forwarding to preview iframe
})
```

### WebContainer Usage in ActionRunner

**File:** `lib/runtime/action-runner.ts`

**Supported Actions:**
1. **File Actions** - Create/modify files via `fs.writeFile()`
2. **Shell Actions** - Execute commands via `spawn()`
3. **Start Actions** - Launch dev server (non-blocking)
4. **Build Actions** - Build project with npm/build tools

**Example Flow:**
```
User Message → Message Parser → Action Detection
  ↓
Action Queue (Sequential execution)
  ↓
Action Runner executes:
  - File modifications
  - Terminal commands
  - Build processes
  ↓
State updates & alerts
```

### File System Management

**FilesStore** (`lib/stores/files.ts`):
- Tracks project files and folders
- Manages file locking (prevents AI from modifying certain files)
- Handles binary file preservation across hot reloads
- Supports file modifications tracking

---

## 4. State Management Approach

### Dual State Management Strategy

**Nanostores** (Global reactive atoms):
- Lightweight, zero-config
- Used for: Chat state, theme, editor state, UI state
- Reactive subscriptions with `useStore()` hook

**Zustand** (Larger stores with actions):
- More structured for complex state
- Used for: Settings dialog, provider configuration
- Actions grouped with state logic

### Key Stores

**Chat-related:**
- `chatStore` - Chat session state (started, aborted, showChat)
- Persistence via IndexedDB (client) or Supabase (server)

**Workbench/IDE:**
- `workbenchStore` - Main IDE state
  - artifacts (code generation results)
  - files (project files)
  - editor (current document)
  - terminal state
  - unsaved changes tracking
  - alerts & notifications

**Settings:**
- `providersStore` - Provider configuration
- `settingsStore` (Zustand) - Dialog state management
- `tabConfigurationStore` - UI layout preferences
- `shortcutsStore` - Keyboard shortcuts

**UI/Theme:**
- `themeStore` - Light/dark mode
- `editorStore` - Code editor state
- `previewsStore` - Preview windows state

### Persistence Layer

**Client-side:**
- IndexedDB for chat history and snapshots
- localStorage for settings and preferences
- `lib/persistence/db.ts` - IndexedDB operations

**Server-side (Supabase):**
- `lib/persistence/supabase.ts` - Chat/message storage
- User authentication required
- Synced after authentication

---

## 5. Architectural Patterns & Interactions

### Message Parsing Pipeline

**Flow:**
```
AI Response (Streaming)
  ↓
StreamingMessageParser (lib/runtime/message-parser.ts)
  ↓
Detect XML tags:
  - <boltArtifact> → Code generation result
  - <boltAction> → File/shell/build actions
  - <bolt-quick-actions> → Suggested quick actions
  ↓
Emit callbacks (onArtifactOpen, onActionOpen, etc.)
  ↓
Update UI State in real-time
```

**Custom XML Format:**
- `<boltArtifact title="..." type="...">` - Code artifacts
- `<boltAction type="file" filePath="...">` - File modifications
- `<boltAction type="shell">` - Terminal commands
- `<bolt-quick-actions>` - Pre-suggested user actions

### Context Window Management

**Features:**
- **Summary Generation** - AI summarizes long chat history
- **Context Selection** - AI selects relevant files to include
- **Message Slicing** - Only recent messages sent to LLM to save tokens

**Implementation:** `lib/.server/llm/`:
- `create-summary.ts` - Generate chat summary
- `select-context.ts` - Select relevant files
- `stream-text.ts` - Format system prompt with context

### Action Execution Queue

**Key Pattern:**
- Sequential execution via promise chaining
- Prevents race conditions between multiple actions
- State sampler for streaming file modifications

**Example:**
```typescript
// GlobalExecutionQueue chains async operations
addToExecutionQueue(async () => {
  await _addAction(data);
  await _runAction(data);
});
```

---

## 6. Supabase Integration for Auth & Storage

### Authentication Flow

**Location:** `lib/supabase/auth.ts` & `components/auth/Auth.tsx`

**Functions:**
- `signUp(email, password)` - User registration
- `signIn(email, password)` - User login
- `getCurrentUser()` - Get authenticated user
- `onAuthStateChange(callback)` - Listen for auth changes

**Client Setup:**
```typescript
// lib/supabase/client.ts
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    }
  }
);
```

### Database Schema

**Tables:**
- `users` - User accounts (auto-created by Auth)
- `chats` - Chat sessions (id, user_id, title, url_id, metadata)
- `messages` - Chat messages (id, chat_id, role, content, sequence)
- `snapshots` - Project snapshots (chat_id, message_id, files_json, summary)

**Database Operations:**
- `lib/persistence/supabase.ts` - All CRUD operations
- User-scoped queries (all chats filtered by user_id)
- Upsert logic for message handling

### Dual Persistence Strategy

**IndexedDB (Client-side):**
- No authentication required
- Better offline support
- Used for temporary/local data

**Supabase (Server-side):**
- Requires authentication
- Persistent across devices
- Shared storage capabilities
- Real-time sync potential

---

## 7. Server-Side LLM Processing

### Streaming Chat Endpoint

**File:** `app/routes/api.chat.ts`

**Flow:**
```
POST /api/chat (User message + context)
  ↓
Extract messages, files, settings from request
  ↓
Optimize context if enabled:
  1. Generate summary of chat history
  2. Select relevant files
  3. Pass to LLM with system prompt
  ↓
Stream response with progress annotations
  ↓
Handle stream recovery (timeout/retry logic)
  ↓
Return data stream with structured chunks
```

**Response Format:**
- Server-Sent Events (SSE) for streaming
- Data annotations (progress, usage, context info)
- Message chunks with artifact parsing

### System Prompt Architecture

**Location:** `lib/common/prompts/prompts.ts`

**Multiple Prompt Versions:**
- Default prompt (generic development)
- Discuss mode prompt (conversation-focused)
- Build mode prompt (with code context)
- Custom prompts via PromptLibrary

**Dynamic Content:**
- Locked files list (files AI cannot modify)
- Available commands
- Project structure
- Design scheme/theme info

### Token Management

**Features:**
- Model-specific max token limits
- Reasoning model detection (o1, GPT-4 thinking)
- Fallback to first available model if not found
- Token limits from provider configurations
- Streaming recovery on timeout

---

## 8. Electron Desktop App Structure

### Electron Support

**Package Dependencies:**
- `electron` - Desktop framework
- `electron-builder` - App packaging
- `electron-log` - Logging to file
- Built as separate bundle target

**Key Considerations:**
- Main process + renderer process architecture
- Uses Vite for building
- Pre-start script via `pre-start.cjs`
- Likely uses native file dialogs and system integration

### Build Process

**Scripts:**
- `pnpm run build` - Vite build (Remix + client)
- `dockerbuild` - Docker image with dependencies
- Output: `build/client` and `build/server` directories

---

## 9. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   User Interface                         │
│  (Chat, Editor, Terminal, Settings, Workbench)         │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
   ┌────▼─────┐    ┌─────▼──────┐
   │ Stores   │    │ Components │
   │ (Nano    │    │ (React)    │
   │ Zustand) │    └─────┬──────┘
   └────┬─────┘          │
        │                │
   ┌────▼──────────────────────────────────┐
   │      Remix Framework                  │
   │  (Routes, Loaders, Actions)           │
   └────┬──────────────┬───────────────────┘
        │              │
   ┌────▼──┐      ┌───▼──────────────┐
   │Client │      │Server-side       │
   │-side  │      │LLM Processing    │
   │Code   │      │Message Parser    │
   │       │      │Action Runner     │
   └────┬──┘      └───┬──────────────┘
        │             │
   ┌────▼─────┬───────▼─────────┐
   │Web       │ AI Providers    │
   │Container │ (OpenAI,        │
   │(Exec)    │  Anthropic,     │
   │          │  etc.)          │
   │          │                 │
   │ Files    │ LLM Responses   │
   │ Terminal │                 │
   │ Preview  │                 │
   └──────────┴──────┬──────────┘
                     │
          ┌──────────┼──────────┐
          │          │          │
      ┌───▼──┐ ┌────▼──┐ ┌────▼──┐
      │Index │ │Local  │ │Supabase
      │edDB  │ │Storage│ │(Auth &DB)
      │      │ │       │ │
      └──────┘ └───────┘ └────────┘
```

---

## 10. Key Integration Points

### Chat Message → Action Execution

1. User submits message
2. Server streams response from LLM
3. Client parses XML for artifacts/actions
4. Actions queued in order
5. File actions update editor
6. Shell actions execute in terminal
7. UI updates in real-time

### Provider Configuration Flow

1. User enters API keys in settings
2. Stored in localStorage + cookies
3. Server fetches models from provider
4. Models cached based on key hash
5. User selects model for chat
6. Selected in message content for server

### WebContainer File Synchronization

1. AI generates code
2. File action detected
3. EditorStore updates UI immediately
4. ActionRunner writes to WebContainer
5. Preview updates automatically
6. File system stays in sync

---

## 11. Performance & Optimization

### Streaming & Progressive Enhancement

- Server-sent events for real-time updates
- Progressive artifact rendering
- Action execution during streaming
- Context summary caching

### State Management Optimization

- Nanostores atoms (minimal re-renders)
- Selective subscriptions in components
- File state only updates when changed
- Terminal state isolated from chat state

### Memory Management

- Hot reload persistence for state
- Binary file handling (preserved across reloads)
- WebContainer lifecycle tied to app lifecycle
- IndexedDB cleanup for old chats

---

## 12. Extension Points

### Adding a New AI Provider

1. Create `lib/modules/llm/providers/my-provider.ts`
2. Extend `BaseProvider`
3. Implement `getModelInstance()` and optional `getDynamicModels()`
4. Auto-registers in LLMManager
5. Add to settings UI for API key input

### Adding Custom Prompts

1. Create file in `lib/common/prompts/`
2. Register in `PromptLibrary`
3. Add to prompt selector in settings
4. Access via `promptId` in chat API

### Custom Actions

1. Extend message parser for new XML tags
2. Create action handler in ActionRunner
3. Update action types in `types/actions.ts`
4. Implement execution logic

---

## Environment Variables

**Client-side (prefixed with VITE_):**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key

**Server-side:**
- `OPENAI_API_KEY` - OpenAI
- `ANTHROPIC_API_KEY` - Anthropic
- `GOOGLE_GENERATIVE_AI_API_KEY` - Google
- `TOGETHER_API_KEY` - Together AI
- Provider-specific settings for local services

---

## Development Commands

```bash
# Development
pnpm run dev          # Start with Vite dev server + Remix

# Build & Deploy
pnpm run build        # Build for Cloudflare Pages
pnpm run deploy       # Deploy to Cloudflare Pages

# Testing
pnpm run test         # Run Vitest
pnpm run test:watch   # Watch mode

# Code Quality
pnpm run lint         # ESLint
pnpm run lint:fix     # Fix linting issues
```

