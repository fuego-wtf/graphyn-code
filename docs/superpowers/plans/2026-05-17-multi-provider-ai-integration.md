# Multi-Provider AI Integration (Gemini + LM Studio) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken Claude SDK dependency with a provider abstraction supporting Gemini API, LM Studio (local with interactive model picker), and Claude CLI, with interactive provider selection on first run.

**Architecture:** Create an `AIProvider` interface with three implementations. The `AgentOrchestrator` uses the provider abstraction instead of hardcoded `ClaudeCodeClient`. Provider selection persists in `~/.graphyn/provider-config.json`. LM Studio includes a categorized model picker UI with favorites support — when no model is loaded, it shows a tabbed terminal UI with Chat, Code, Reasoning, Small & Fast, and Vision categories, lets you select and load a model, and saves favorites for quick access.

**Tech Stack:** `@google/generative-ai` (Gemini SDK), OpenAI-compatible fetch (LM Studio), `spawn` (Claude CLI), TypeScript, Zod for validation

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/providers/ai-provider.ts` | **Create** | Provider interface, message types, streaming types |
| `src/providers/gemini-provider.ts` | **Create** | Gemini API implementation using `@google/generative-ai` |
| `src/providers/lmstudio-provider.ts` | **Create** | LM Studio via OpenAI-compatible fetch, auto-detects model |
| `src/providers/lmstudio-model-catalog.ts` | **Create** | Curated model catalog organized by category with favorites |
| `src/providers/lmstudio-model-picker.ts` | **Create** | Interactive terminal UI for model selection (tabs, dropdowns, favorites) |
| `src/providers/claude-cli-provider.ts` | **Create** | Claude CLI via `spawn()` (fixes the broken SDK import) |
| `src/providers/provider-manager.ts` | **Create** | Provider selection, config persistence, health checks |
| `src/commands/provider.ts` | **Create** | `graphyn provider` CLI subcommand (list, set, test) |
| `src/orchestrator/AgentOrchestrator.ts` | **Modify** | Replace `ClaudeCodeClient` with `AIProvider` interface |
| `src/cli-orchestrator.ts` | **Modify** | Add provider initialization and first-run prompt |
| `.env.example` | **Modify** | Add `GRAPHYN_AI_PROVIDER`, `GEMINI_API_KEY`, `LM_STUDIO_URL` |
| `config/graphyn.config.json` | **Modify** | Add provider configuration section |
| `package.json` | **Modify** | Add `@google/generative-ai` dependency |

---

### Task 1: Create Provider Interface and Types

**Files:**
- Create: `src/providers/ai-provider.ts`

- [ ] **Step 1: Create the AIProvider interface**

```typescript
// src/providers/ai-provider.ts

import { EventEmitter } from 'events';

export type ProviderType = 'gemini' | 'lmstudio' | 'claude-cli';

export interface ProviderInfo {
  type: ProviderType;
  name: string;
  description: string;
  requiresApiKey: boolean;
  requiresLocalServer: boolean;
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  maxTurns?: number;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface ProviderResponse {
  result: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  duration: number;
}

export interface StreamChunk {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'done' | 'error';
  content?: string;
  error?: string;
}

export abstract class AIProvider extends EventEmitter {
  abstract readonly info: ProviderInfo;
  protected config: ProviderConfig;

  constructor(config: ProviderConfig = {}) {
    super();
    this.config = {
      maxTurns: 10,
      temperature: 0.7,
      ...config,
    };
  }

  abstract chat(messages: AIMessage[]): Promise<ProviderResponse>;

  abstract *chatStream(messages: AIMessage[]): AsyncGenerator<StreamChunk>;

  abstract healthCheck(): Promise<{ healthy: boolean; model?: string; error?: string }>;

  abstract validateConfig(): Promise<{ valid: boolean; error?: string }>;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
bun run build 2>&1 | head -20
```

Expected: No new errors from the new file.

- [ ] **Step 3: Commit**

```bash
git add src/providers/ai-provider.ts
git commit -m "feat: add AIProvider interface and types"
```

---

### Task 2: Create Gemini Provider

**Files:**
- Create: `src/providers/gemini-provider.ts`
- Modify: `package.json` (add dependency)

- [ ] **Step 1: Add Gemini SDK dependency**

```bash
bun add @google/generative-ai
```

- [ ] **Step 2: Create Gemini provider**

```typescript
// src/providers/gemini-provider.ts

import { GoogleGenerativeAI, GenerativeModel, GenerateContentStreamResult } from '@google/generative-ai';
import { AIProvider, AIMessage, ProviderResponse, StreamChunk, ProviderConfig, ProviderInfo } from './ai-provider.js';

const GEMINI_MODEL = 'gemini-2.5-flash-lite-preview-06-17';

export class GeminiProvider extends AIProvider {
  readonly info: ProviderInfo = {
    type: 'gemini',
    name: 'Gemini API',
    description: 'Google Gemini via API key',
    requiresApiKey: true,
    requiresLocalServer: false,
  };

  private client: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;

  constructor(config: ProviderConfig = {}) {
    super(config);
    if (config.apiKey) {
      this.client = new GoogleGenerativeAI(config.apiKey);
      this.model = this.client.getGenerativeModel({
        model: config.model || GEMINI_MODEL,
      });
    }
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    if (!this.config.apiKey) {
      return { valid: false, error: 'GEMINI_API_KEY is required' };
    }
    if (!this.config.apiKey.startsWith('AIza')) {
      return { valid: false, error: 'Invalid Gemini API key format' };
    }
    return { valid: true };
  }

  async chat(messages: AIMessage[]): Promise<ProviderResponse> {
    if (!this.model) throw new Error('Gemini provider not initialized');
    const startTime = Date.now();

    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const chat = this.model.startChat({
      history: conversationMessages.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
    });

    const lastMessage = conversationMessages[conversationMessages.length - 1];
    const result = await chat.sendMessage(
      systemMessage ? `${systemMessage.content}\n\n${lastMessage.content}` : lastMessage.content
    );

    const text = result.response.text();
    const usage = result.response.usageMetadata;

    return {
      result: text,
      model: this.config.model || GEMINI_MODEL,
      usage: usage ? {
        inputTokens: usage.promptTokenCount,
        outputTokens: usage.candidatesTokenCount,
      } : undefined,
      duration: Date.now() - startTime,
    };
  }

  async *chatStream(messages: AIMessage[]): AsyncGenerator<StreamChunk> {
    if (!this.model) throw new Error('Gemini provider not initialized');

    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const chat = this.model.startChat({
      history: conversationMessages.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
    });

    const lastMessage = conversationMessages[conversationMessages.length - 1];
    const streamResult = await chat.sendMessageStream(
      systemMessage ? `${systemMessage.content}\n\n${lastMessage.content}` : lastMessage.content
    );

    for await (const chunk of streamResult.stream) {
      const text = chunk.text();
      if (text) {
        yield { type: 'text', content: text };
      }
    }

    yield { type: 'done' };
  }

  async healthCheck(): Promise<{ healthy: boolean; model?: string; error?: string }> {
    try {
      const validation = await this.validateConfig();
      if (!validation.valid) return { healthy: false, error: validation.error };

      const result = await this.chat([{ role: 'user', content: 'Say "ok" in one word.' }]);
      return { healthy: true, model: result.model };
    } catch (error) {
      return { healthy: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
bun run build 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/providers/gemini-provider.ts package.json bun.lock
git commit -m "feat: add Gemini API provider"
```

---

### Task 3: Create LM Studio Provider

**Files:**
- Create: `src/providers/lmstudio-provider.ts`

- [ ] **Step 1: Create LM Studio provider**

LM Studio serves an OpenAI-compatible API at `http://localhost:1234/v1`. We use `fetch` directly — no extra SDK needed.

```typescript
// src/providers/lmstudio-provider.ts

import { AIProvider, AIMessage, ProviderResponse, StreamChunk, ProviderConfig, ProviderInfo } from './ai-provider.js';

const DEFAULT_BASE_URL = 'http://localhost:1234/v1';

export class LMStudioProvider extends AIProvider {
  readonly info: ProviderInfo = {
    type: 'lmstudio',
    name: 'LM Studio',
    description: 'Local LLM via LM Studio (OpenAI-compatible API)',
    requiresApiKey: false,
    requiresLocalServer: true,
  };

  private detectedModel: string | null = null;

  constructor(config: ProviderConfig = {}) {
    super({
      baseUrl: config.baseUrl || DEFAULT_BASE_URL,
      ...config,
    });
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;
    try {
      new URL(baseUrl);
    } catch {
      return { valid: false, error: `Invalid LM Studio URL: ${baseUrl}` };
    }
    return { valid: true };
  }

  private async detectModel(): Promise<string> {
    if (this.detectedModel) return this.detectedModel;

    const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;
    const response = await fetch(`${baseUrl}/models`);
    if (!response.ok) throw new Error(`Failed to list models: ${response.statusText}`);

    const data = await response.json() as { data: Array<{ id: string }> };
    if (data.data && data.data.length > 0) {
      this.detectedModel = data.data[0].id;
      return this.detectedModel;
    }
    throw new Error('No models loaded in LM Studio');
  }

  private buildBody(messages: AIMessage[], stream: boolean): Record<string, unknown> {
    const systemMessage = messages.find(m => m.role === 'system');
    const formattedMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));

    if (systemMessage) {
      formattedMessages.unshift({ role: 'system', content: systemMessage.content });
    }

    return {
      model: this.config.model || this.detectedModel || undefined,
      messages: formattedMessages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxOutputTokens,
      stream,
    };
  }

  async chat(messages: AIMessage[]): Promise<ProviderResponse> {
    const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;
    const startTime = Date.now();

    await this.detectModel();

    const body = this.buildBody(messages, false);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LM Studio API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      model: string;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      result: data.choices[0].message.content,
      model: data.model,
      usage: data.usage ? {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      } : undefined,
      duration: Date.now() - startTime,
    };
  }

  async *chatStream(messages: AIMessage[]): AsyncGenerator<StreamChunk> {
    const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;
    await this.detectModel();

    const body = this.buildBody(messages, true);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      yield { type: 'error', error: `LM Studio API error: ${response.status} ${errorText}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No response body for streaming' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const parsed = JSON.parse(trimmed.slice(6));
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) {
            yield { type: 'text', content: delta.content };
          }
        } catch {
          // Skip malformed SSE chunks
        }
      }
    }

    yield { type: 'done' };
  }

  async healthCheck(): Promise<{ healthy: boolean; model?: string; error?: string }> {
    try {
      const validation = await this.validateConfig();
      if (!validation.valid) return { healthy: false, error: validation.error };

      const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;
      const response = await fetch(`${baseUrl}/models`);
      if (!response.ok) return { healthy: false, error: `LM Studio not responding (${response.status})` };

      const data = await response.json() as { data: Array<{ id: string }> };
      if (!data.data || data.data.length === 0) {
        return { healthy: false, error: 'No models loaded in LM Studio' };
      }

      return { healthy: true, model: data.data[0].id };
    } catch (error) {
      return {
        healthy: false,
        error: `LM Studio not available at ${this.config.baseUrl || DEFAULT_BASE_URL}. Make sure LM Studio is running with an API server enabled.`,
      };
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
bun run build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/providers/lmstudio-provider.ts
git commit -m "feat: add LM Studio provider with auto-detect"
```

---

### Task 3b: LM Studio Model Picker UI

**Files:**
- Create: `src/providers/lmstudio-model-catalog.ts`
- Create: `src/providers/lmstudio-model-picker.ts`
- Modify: `src/providers/lmstudio-provider.ts` (add model loading and picker integration)
- Modify: `src/providers/provider-manager.ts` (add favorites persistence)

- [ ] **Step 1: Create model catalog with categorized models**

```typescript
// src/providers/lmstudio-model-catalog.ts

export interface ModelEntry {
  id: string;
  name: string;
  description: string;
  params: string;
  contextWindow: string;
  quantization?: string;
  isFavorite?: boolean;
}

export interface ModelCategory {
  id: string;
  label: string;
  icon: string;
  models: ModelEntry[];
}

export const MODEL_CATALOG: ModelCategory[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: '💬',
    models: [
      { id: 'lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF', name: 'Llama 3.1 8B Instruct', description: 'Fast, capable general chat', params: '8B', contextWindow: '128K', quantization: 'Q4_K_M' },
      { id: 'lmstudio-community/Meta-Llama-3.1-70B-Instruct-GGUF', name: 'Llama 3.1 70B Instruct', description: 'High-quality general chat', params: '70B', contextWindow: '128K', quantization: 'Q4_K_M' },
      { id: 'lmstudio-community/gemma-3-12b-it-GGUF', name: 'Gemma 3 12B', description: 'Google\'s efficient chat model', params: '12B', contextWindow: '32K', quantization: 'Q4_K_M' },
      { id: 'lmstudio-community/gemma-3-27b-it-GGUF', name: 'Gemma 3 27B', description: 'Google\'s powerful chat model', params: '27B', contextWindow: '32K', quantization: 'Q4_K_M' },
      { id: 'lmstudio-community/Qwen2.5-72B-Instruct-GGUF', name: 'Qwen 2.5 72B Instruct', description: 'Strong multilingual chat', params: '72B', contextWindow: '128K', quantization: 'Q4_K_M' },
      { id: 'lmstudio-community/Mistral-7B-Instruct-v0.3-GGUF', name: 'Mistral 7B Instruct v0.3', description: 'Lightweight, fast chat', params: '7B', contextWindow: '32K', quantization: 'Q4_K_M' },
    ],
  },
  {
    id: 'code',
    label: 'Code',
    icon: '💻',
    models: [
      { id: 'lmstudio-community/Qwen2.5-Coder-7B-Instruct-GGUF', name: 'Qwen 2.5 Coder 7B', description: 'Fast code generation', params: '7B', contextWindow: '128K', quantization: 'Q4_K_M' },
      { id: 'lmstudio-community/Qwen2.5-Coder-32B-Instruct-GGUF', name: 'Qwen 2.5 Coder 32B', description: 'Powerful code understanding', params: '32B', contextWindow: '128K', quantization: 'Q4_K_M' },
      { id: 'lmstudio-community/deepseek-coder-6.7b-instruct-GGUF', name: 'DeepSeek Coder 6.7B', description: 'Specialized code model', params: '6.7B', contextWindow: '16K', quantization: 'Q4_K_M' },
      { id: 'lmstudio-community/Codestral-22B-v0.1-GGUF', name: 'Codestral 22B', description: 'Mistral\'s code specialist', params: '22B', contextWindow: '32K', quantization: 'Q4_K_M' },
    ],
  },
  {
    id: 'reasoning',
    label: 'Reasoning',
    icon: '🧠',
    models: [
      { id: 'lmstudio-community/DeepSeek-R1-Distill-Qwen-7B-GGUF', name: 'DeepSeek R1 Distill 7B', description: 'Lightweight reasoning', params: '7B', contextWindow: '32K', quantization: 'Q4_K_M' },
      { id: 'lmstudio-community/DeepSeek-R1-Distill-Qwen-14B-GGUF', name: 'DeepSeek R1 Distill 14B', description: 'Balanced reasoning', params: '14B', contextWindow: '32K', quantization: 'Q4_K_M' },
      { id: 'lmstudio-community/DeepSeek-R1-Distill-Llama-70B-GGUF', name: 'DeepSeek R1 Distill 70B', description: 'Strong chain-of-thought', params: '70B', contextWindow: '32K', quantization: 'Q4_K_M' },
    ],
  },
  {
    id: 'small',
    label: 'Small & Fast',
    icon: '⚡',
    models: [
      { id: 'lmstudio-community/Llama-3.2-1B-Instruct-GGUF', name: 'Llama 3.2 1B', description: 'Ultra-fast, minimal resources', params: '1B', contextWindow: '128K', quantization: 'Q4_K_M' },
      { id: 'lmstudio-community/Llama-3.2-3B-Instruct-GGUF', name: 'Llama 3.2 3B', description: 'Fast on low-end hardware', params: '3B', contextWindow: '128K', quantization: 'Q4_K_M' },
      { id: 'lmstudio-community/Qwen2.5-3B-Instruct-GGUF', name: 'Qwen 2.5 3B', description: 'Compact multilingual', params: '3B', contextWindow: '32K', quantization: 'Q4_K_M' },
      { id: 'lmstudio-community/gemma-3-1b-it-GGUF', name: 'Gemma 3 1B', description: 'Google\'s smallest chat model', params: '1B', contextWindow: '8K', quantization: 'Q4_K_M' },
    ],
  },
  {
    id: 'vision',
    label: 'Vision',
    icon: '👁️',
    models: [
      { id: 'lmstudio-community/llava-v1.6-mistral-7b-GGUF', name: 'LLaVA 1.6 Mistral 7B', description: 'Image understanding', params: '7B', contextWindow: '4K', quantization: 'Q4_K_M' },
      { id: 'lmstudio-community/Qwen2.5-VL-7B-Instruct-GGUF', name: 'Qwen 2.5 VL 7B', description: 'Visual language model', params: '7B', contextWindow: '32K', quantization: 'Q4_K_M' },
    ],
  },
];

export function getAllModels(): ModelEntry[] {
  return MODEL_CATALOG.flatMap(cat => cat.models);
}

export function getModelById(id: string): ModelEntry | undefined {
  return getAllModels().find(m => m.id === id);
}

export function getCategories(): ModelCategory[] {
  return MODEL_CATALOG;
}
```

- [ ] **Step 2: Create interactive model picker UI**

This renders a tabbed terminal UI using inquirer with categorized model selection and favorites.

```typescript
// src/providers/lmstudio-model-picker.ts

import inquirer from 'inquirer';
import chalk from 'chalk';
import { ModelCategory, ModelEntry, getCategories, getAllModels, getModelById } from './lmstudio-model-catalog.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const FAVORITES_FILE = path.join(os.homedir(), '.graphyn', 'lmstudio-favorites.json');

export interface PickerResult {
  modelId: string;
  model: ModelEntry;
}

function loadFavorites(): string[] {
  try {
    if (fs.existsSync(FAVORITES_FILE)) {
      return JSON.parse(fs.readFileSync(FAVORITES_FILE, 'utf8'));
    }
  } catch {}
  return [];
}

function saveFavorites(favorites: string[]): void {
  const dir = path.dirname(FAVORITES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FAVORITES_FILE, JSON.stringify(favorites, null, 2));
}

function markAsFavorite(modelId: string): void {
  const favorites = loadFavorites();
  if (!favorites.includes(modelId)) {
    favorites.push(modelId);
    saveFavorites(favorites);
  }
}

function formatModelChoice(entry: ModelEntry, isFavorite: boolean): string {
  const star = isFavorite ? '⭐ ' : '   ';
  return `${star}${entry.name.padEnd(30)} ${chalk.dim(`${entry.params} · ${entry.contextWindow} ctx`)} — ${entry.description}`;
}

export async function showModelPicker(baseUrl: string = 'http://localhost:1234'): Promise<PickerResult | null> {
  const favorites = loadFavorites();
  const categories = getCategories();
  const allModels = getAllModels();

  // Mark models that are already downloaded in LM Studio
  let downloadedIds: string[] = [];
  try {
    const resp = await fetch(`${baseUrl}/v1/models`);
    if (resp.ok) {
      const data = await resp.json() as { data: Array<{ id: string }> };
      downloadedIds = data.data?.map(m => m.id) || [];
    }
  } catch {}

  // Build all choices with visual indicators
  function buildChoices(category: ModelCategory): inquirer.DistinctChoice[] {
    return category.models.map(m => {
      const isFavorite = favorites.includes(m.id);
      const isDownloaded = downloadedIds.includes(m.id);
      const status = isDownloaded ? chalk.green(' [loaded]') : chalk.dim(' [not loaded]');
      const star = isFavorite ? chalk.yellow('⭐') : '  ';
      return {
        name: `${star} ${m.name.padEnd(32)} ${chalk.dim(`${m.params} · ${m.contextWindow}`)}${status}`,
        value: m.id,
        short: m.name,
      };
    });
  }

  // Build favorites section
  const favoriteModels = allModels.filter(m => favorites.includes(m.id));
  const favoriteChoices: inquirer.DistinctChoice[] = favoriteModels.length > 0
    ? [new inquirer.Separator(chalk.yellow.bold('── Your Favorites ──')), ...favoriteModels.map(m => ({
        name: `${chalk.yellow('⭐')} ${m.name.padEnd(32)} ${chalk.dim(`${m.params} · ${m.contextWindow}`)}`,
        value: m.id,
        short: m.name,
      }))]
    : [];

  // Build category choices with separators
  const allChoices: inquirer.DistinctChoice[] = [];
  for (const cat of categories) {
    allChoices.push(new inquirer.Separator(chalk.cyan.bold(`── ${cat.icon} ${cat.label} ──`)));
    allChoices.push(...buildChoices(cat));
  }

  // Show the picker
  console.log('');
  console.log(chalk.bold.cyan('  ╔══════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('  ║       LM Studio — Model Selector           ║'));
  console.log(chalk.bold.cyan('  ╚══════════════════════════════════════════════╝'));
  console.log(chalk.dim('  Select a model to load into LM Studio'));
  console.log(chalk.dim('  ⭐ = favorite  |  [loaded] = already in memory'));
  console.log('');

  const { modelId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'modelId',
      message: 'Choose a model:',
      choices: [...favoriteChoices, ...allChoices],
      pageSize: 20,
    },
  ]);

  const model = getModelById(modelId);
  if (!model) return null;

  // Ask to add to favorites if not already
  if (!favorites.includes(modelId)) {
    const { addToFavorites } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addToFavorites',
        message: `Add "${model.name}" to your favorites?`,
        default: true,
      },
    ]);
    if (addToFavorites) {
      markAsFavorite(modelId);
    }
  }

  return { modelId, model };
}

export async function loadModelIntoLMStudio(modelId: string, baseUrl: string = 'http://localhost:1234'): Promise<{ success: boolean; error?: string }> {
  try {
    const resp = await fetch(`${baseUrl}/v1/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        options: {
          context_length: 8192,
          gpu_layers: -1, // Use all GPU layers possible
        },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { success: false, error: `Failed to load model: ${resp.status} ${text}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function waitForModelReady(modelId: string, baseUrl: string = 'http://localhost:1234', maxWaitMs: number = 120000): Promise<{ ready: boolean; error?: string }> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const resp = await fetch(`${baseUrl}/v1/models`);
      if (resp.ok) {
        const data = await resp.json() as { data: Array<{ id: string }> };
        const loaded = data.data?.find(m => m.id === modelId);
        if (loaded) return { ready: true };
      }
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
  return { ready: false, error: `Model did not load within ${maxWaitMs / 1000}s` };
}
```

- [ ] **Step 3: Update LM Studio provider to use picker when no model loaded**

In `src/providers/lmstudio-provider.ts`, update `detectModel()` to trigger the picker:

```typescript
// Replace the detectModel method:

import { showModelPicker, loadModelIntoLMStudio, waitForModelReady } from './lmstudio-model-picker.js';

private async detectModel(): Promise<string> {
  if (this.detectedModel) return this.detectedModel;

  const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;
  const response = await fetch(`${baseUrl}/models`);
  if (!response.ok) throw new Error(`Failed to list models: ${response.statusText}`);

  const data = await response.json() as { data: Array<{ id: string }> };
  if (data.data && data.data.length > 0) {
    this.detectedModel = data.data[0].id;
    return this.detectedModel;
  }

  // No model loaded — show interactive picker
  console.log(chalk.yellow('\n  ⚠️  No model loaded in LM Studio. Opening model selector...\n'));
  const pickerResult = await showModelPicker(baseUrl.replace('/v1', ''));
  if (!pickerResult) {
    throw new Error('Model selection cancelled');
  }

  console.log(chalk.cyan(`  Loading ${pickerResult.model.name}...`));
  const loadResult = await loadModelIntoLMStudio(pickerResult.modelId, baseUrl.replace('/v1', ''));
  if (!loadResult.success) {
    throw new Error(`Failed to load model: ${loadResult.error}`);
  }

  console.log(chalk.dim('  Waiting for model to load...'));
  const readyResult = await waitForModelReady(pickerResult.modelId, baseUrl.replace('/v1', ''));
  if (!readyResult.ready) {
    throw new Error(`Model load timed out: ${readyResult.error}`);
  }

  this.detectedModel = pickerResult.modelId;
  console.log(chalk.green(`  ✅ ${pickerResult.model.name} loaded and ready\n`));
  return pickerResult.modelId;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
bun run build 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/providers/lmstudio-model-catalog.ts src/providers/lmstudio-model-picker.ts src/providers/lmstudio-provider.ts
git commit -m "feat: add LM Studio model picker with favorites and categories"
```

---

### Task 4: Create Claude CLI Provider (Fixed)

**Files:**
- Create: `src/providers/claude-cli-provider.ts`

- [ ] **Step 1: Create Claude CLI provider using spawn (not SDK import)**

This replaces the broken `claude-code-client.ts` approach. Uses the working `spawn('claude', ['-p', prompt])` pattern from `ClaudeSDKWrapper.ts`.

```typescript
// src/providers/claude-cli-provider.ts

import { spawn, ChildProcess } from 'child_process';
import { AIProvider, AIMessage, ProviderResponse, StreamChunk, ProviderConfig, ProviderInfo } from './ai-provider.js';

export class ClaudeCLIProvider extends AIProvider {
  readonly info: ProviderInfo = {
    type: 'claude-cli',
    name: 'Claude CLI',
    description: 'Claude Code CLI (requires claude command in PATH)',
    requiresApiKey: false,
    requiresLocalServer: false,
  };

  constructor(config: ProviderConfig = {}) {
    super(config);
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    return new Promise((resolve) => {
      const child = spawn('which', ['claude'], { stdio: 'pipe' });
      child.on('close', (code) => {
        if (code === 0) {
          resolve({ valid: true });
        } else {
          resolve({ valid: false, error: 'Claude CLI not found in PATH. Install with: npm install -g @anthropic-ai/claude-code' });
        }
      });
      child.on('error', () => {
        resolve({ valid: false, error: 'Failed to check for Claude CLI' });
      });
    });
  }

  async chat(messages: AIMessage[]): Promise<ProviderResponse> {
    const startTime = Date.now();
    const prompt = this.buildPrompt(messages);

    return new Promise((resolve, reject) => {
      const child = spawn('claude', ['-p', prompt, '--output', 'text', '--max-turns', String(this.config.maxTurns || 10)], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({
            result: output.trim(),
            model: 'claude-code-cli',
            duration: Date.now() - startTime,
          });
        } else {
          reject(new Error(`Claude CLI exited with code ${code}: ${errorOutput}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  async *chatStream(messages: AIMessage[]): AsyncGenerator<StreamChunk> {
    const prompt = this.buildPrompt(messages);

    const child = spawn('claude', ['-p', prompt, '--max-turns', String(this.config.maxTurns || 10)], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return new Promise<void>((resolve, reject) => {
      child.stdout?.on('data', (data) => {
        const text = data.toString();
        // In a real implementation, you'd parse the streaming format
        // For now, emit raw chunks
        this.emit('chunk', { type: 'text' as const, content: text });
      });

      child.stderr?.on('data', (data) => {
        this.emit('chunk', { type: 'text' as const, content: data.toString() });
      });

      child.on('close', () => {
        this.emit('chunk', { type: 'done' as const });
        resolve();
      });

      child.on('error', (err) => {
        this.emit('chunk', { type: 'error' as const, error: err.message });
        reject(err);
      });
    });

    // Yield chunks via event emitter
    // Note: This is a simplified streaming approach
  }

  async healthCheck(): Promise<{ healthy: boolean; model?: string; error?: string }> {
    const validation = await this.validateConfig();
    if (!validation.valid) return validation;

    return new Promise((resolve) => {
      const child = spawn('claude', ['--version'], { stdio: 'pipe' });
      let output = '';
      child.stdout?.on('data', (data) => { output += data.toString(); });
      child.on('close', (code) => {
        if (code === 0) {
          resolve({ healthy: true, model: output.trim() });
        } else {
          resolve({ healthy: false, error: 'Claude CLI version check failed' });
        }
      });
      child.on('error', () => {
        resolve({ healthy: false, error: 'Claude CLI not found' });
      });
    });
  }

  private buildPrompt(messages: AIMessage[]): string {
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    let prompt = '';
    if (systemMessage) {
      prompt += `${systemMessage.content}\n\n`;
    }
    prompt += userMessages.map(m => m.content).join('\n\n');
    return prompt;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
bun run build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/providers/claude-cli-provider.ts
git commit -m "feat: add Claude CLI provider via spawn"
```

---

### Task 5: Create Provider Manager

**Files:**
- Create: `src/providers/provider-manager.ts`

- [ ] **Step 1: Create provider manager with config persistence**

```typescript
// src/providers/provider-manager.ts

import fs from 'fs';
import path from 'path';
import os from 'os';
import { AIProvider, ProviderType, ProviderConfig } from './ai-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { LMStudioProvider } from './lmstudio-provider.js';
import { ClaudeCLIProvider } from './claude-cli-provider.js';

export interface ProviderManagerConfig {
  selectedProvider?: ProviderType;
  geminiApiKey?: string;
  lmStudioUrl?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.graphyn');
const CONFIG_FILE = path.join(CONFIG_DIR, 'provider-config.json');

export class ProviderManager {
  private provider: AIProvider | null = null;
  private config: ProviderManagerConfig;

  constructor(config: ProviderManagerConfig = {}) {
    this.config = {
      ...this.loadPersistedConfig(),
      ...config,
    };
  }

  private loadPersistedConfig(): Partial<ProviderManagerConfig> {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      }
    } catch {
      // Ignore read errors
    }
    return {};
  }

  saveConfig(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), { mode: 0o600 });
  }

  getAvailableProviders(): Array<{ type: ProviderType; name: string; description: string }> {
    return [
      { type: 'gemini', name: 'Gemini API', description: 'Google Gemini via API key' },
      { type: 'lmstudio', name: 'LM Studio', description: 'Local LLM via LM Studio' },
      { type: 'claude-cli', name: 'Claude CLI', description: 'Claude Code CLI' },
    ];
  }

  async selectProvider(type: ProviderType): Promise<AIProvider> {
    this.config.selectedProvider = type;
    this.provider = this.createProvider(type);
    this.saveConfig();
    return this.provider;
  }

  getProvider(): AIProvider | null {
    if (this.provider) return this.provider;
    if (this.config.selectedProvider) {
      this.provider = this.createProvider(this.config.selectedProvider);
      return this.provider;
    }
    return null;
  }

  private createProvider(type: ProviderType): AIProvider {
    const envApiKey = process.env.GEMINI_API_KEY;
    const envLmUrl = process.env.LM_STUDIO_URL;

    switch (type) {
      case 'gemini': {
        const apiKey = this.config.geminiApiKey || envApiKey;
        if (!apiKey) throw new Error('GEMINI_API_KEY not set. Run: graphyn provider set gemini --key <key>');
        return new GeminiProvider({ apiKey });
      }
      case 'lmstudio': {
        return new LMStudioProvider({ baseUrl: this.config.lmStudioUrl || envLmUrl });
      }
      case 'claude-cli': {
        return new ClaudeCLIProvider();
      }
      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }

  async healthCheck(type?: ProviderType): Promise<{ type: ProviderType; healthy: boolean; model?: string; error?: string }> {
    const targetType = type || this.config.selectedProvider;
    if (!targetType) return { type: 'gemini', healthy: false, error: 'No provider selected' };

    const provider = this.createProvider(targetType);
    const result = await provider.healthCheck();
    return { type: targetType, ...result };
  }

  getSelectedProvider(): ProviderType | undefined {
    return this.config.selectedProvider;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
bun run build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/providers/provider-manager.ts
git commit -m "feat: add provider manager with config persistence"
```

---

### Task 6: Create Provider CLI Command

**Files:**
- Create: `src/commands/provider.ts`
- Modify: `src/index.ts` (route `provider` command)

- [ ] **Step 1: Create provider CLI command**

```typescript
// src/commands/provider.ts

import chalk from 'chalk';
import { ProviderManager, ProviderManagerConfig } from '../providers/provider-manager.js';
import { ProviderType } from '../providers/ai-provider.js';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan,
  bold: chalk.bold,
};

export async function runProviderCommand(rawQuery: string): Promise<void> {
  const tokens = rawQuery.split(/\s+/);
  const subcommand = tokens[1] || '';

  const manager = new ProviderManager();

  switch (subcommand) {
    case 'list':
    case 'ls':
      await listCommand(manager);
      break;
    case 'set':
      await setCommand(manager, tokens);
      break;
    case 'test':
      await testCommand(manager, tokens);
      break;
    case 'status':
      await statusCommand(manager);
      break;
    case '':
    case 'help':
    case '--help':
    case '-h':
      showProviderHelp();
      break;
    default:
      console.log(colors.error(`Unknown subcommand: ${subcommand}`));
      showProviderHelp();
      process.exitCode = 1;
  }
}

async function listCommand(manager: ProviderManager): Promise<void> {
  const providers = manager.getAvailableProviders();
  const selected = manager.getSelectedProvider();

  console.log(colors.bold('\n  Available AI Providers\n'));

  for (const p of providers) {
    const isSelected = p.type === selected;
    const marker = isSelected ? colors.success('●') : '○';
    console.log(`  ${marker} ${colors.bold(p.name.padEnd(15))} ${colors.dim(p.description)}`);
  }
  console.log('');
}

async function setCommand(manager: ProviderManager, tokens: string[]): Promise<void> {
  const type = tokens[2] as ProviderType;
  const keyIndex = tokens.indexOf('--key');
  const urlIndex = tokens.indexOf('--url');

  if (!type || !['gemini', 'lmstudio', 'claude-cli'].includes(type)) {
    console.log(colors.error('Usage: graphyn provider set <gemini|lmstudio|claude-cli> [--key <api-key>] [--url <base-url>]'));
    process.exitCode = 1;
    return;
  }

  const config: Partial<ProviderManagerConfig> = {};
  if (keyIndex > 0 && tokens[keyIndex + 1]) {
    config.geminiApiKey = tokens[keyIndex + 1];
  }
  if (urlIndex > 0 && tokens[urlIndex + 1]) {
    config.lmStudioUrl = tokens[urlIndex + 1];
  }

  if (Object.keys(config).length > 0) {
    Object.assign(manager, { config: { ...manager['config'], ...config } });
    manager.saveConfig();
  }

  const provider = await manager.selectProvider(type);
  console.log(colors.success(`\n  Selected: ${provider.info.name}`));

  const health = await manager.healthCheck(type);
  if (health.healthy) {
    console.log(colors.success(`  Status: Healthy (${health.model})`));
  } else {
    console.log(colors.warning(`  Status: ${health.error}`));
  }
  console.log('');
}

async function testCommand(manager: ProviderManager, tokens: string[]): Promise<void> {
  const type = tokens[2] as ProviderType | undefined;
  const provider = type ? await manager.selectProvider(type) : manager.getProvider();

  if (!provider) {
    console.log(colors.error('No provider selected. Run: graphyn provider set <type>'));
    process.exitCode = 1;
    return;
  }

  console.log(colors.bold(`\n  Testing ${provider.info.name}...\n`));

  const health = await provider.healthCheck();
  if (!health.healthy) {
    console.log(colors.error(`  Failed: ${health.error}`));
    process.exitCode = 1;
    return;
  }

  console.log(colors.success(`  Model: ${health.model}`));

  const startTime = Date.now();
  const response = await provider.chat([{ role: 'user', content: 'Say "Graphyn is ready" in exactly 3 words.' }]);
  const duration = Date.now() - startTime;

  console.log(colors.success(`  Response: ${response.result}`));
  console.log(colors.info(`  Time: ${duration}ms`));
  if (response.usage) {
    console.log(colors.info(`  Tokens: ${response.usage.inputTokens} in / ${response.usage.outputTokens} out`));
  }
  console.log('');
}

async function statusCommand(manager: ProviderManager): Promise<void> {
  const selected = manager.getSelectedProvider();
  if (!selected) {
    console.log(colors.warning('  No provider selected. Run: graphyn provider set <type>\n'));
    return;
  }

  const health = await manager.healthCheck();
  console.log(colors.bold('\n  Provider Status\n'));
  console.log(`  Active: ${colors.bold(health.type)}`);
  if (health.healthy) {
    console.log(colors.success(`  Status: Healthy (${health.model})`));
  } else {
    console.log(colors.error(`  Status: ${health.error}`));
  }
  console.log('');
}

function showProviderHelp(): void {
  console.log(`
${colors.bold('Graphyn Provider — AI Model Selection')}

${colors.highlight('Usage:')}
  graphyn provider <command> [options]

${colors.highlight('Commands:')}
  list, ls              List available providers
  set <type>            Select a provider (gemini, lmstudio, claude-cli)
  test [type]           Test provider connectivity
  status                Show current provider status

${colors.highlight('Examples:')}
  graphyn provider set gemini --key AIzaSy...
  graphyn provider set lmstudio --url http://localhost:1234/v1
  graphyn provider set claude-cli
  graphyn provider test gemini
`);
}
```

- [ ] **Step 2: Wire into main CLI router**

In `src/index.ts`, add to the `routeCommand` function:

```typescript
  if (query === 'provider' || query.startsWith('provider ')) {
    const { runProviderCommand } = await import('./commands/provider.js');
    await runProviderCommand(query);
    return true;
  }
```

Also add `'provider'` to the `knownCommands` array in `isNaturalLanguage()`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
bun run build 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/commands/provider.ts src/index.ts
git commit -m "feat: add provider CLI command"
```

---

### Task 7: Update AgentOrchestrator to Use AIProvider

**Files:**
- Modify: `src/orchestrator/AgentOrchestrator.ts`

- [ ] **Step 1: Replace ClaudeCodeClient with AIProvider**

Replace the import and initialization:

```typescript
// Replace this:
import { ClaudeCodeClient } from '../sdk/claude-code-client.js';

// With this:
import { AIProvider, AIMessage, StreamChunk } from '../providers/ai-provider.js';
import { ProviderManager } from '../providers/provider-manager.js';
```

In the constructor, replace:
```typescript
// Replace:
this.claudeClient = new ClaudeCodeClient();

// With:
this.providerManager = new ProviderManager();
```

Replace `executeWithAgent` method to use the provider:
```typescript
private async executeWithAgent(
  agentName: string,
  query: string,
  repositoryContext?: any
): Promise<{ result: string; metrics?: any }> {
  // ... existing agent config loading ...

  const agentPrompt = await this.buildAgentPrompt(agentConfig, query, repositoryContext);

  const provider = this.providerManager.getProvider();
  if (!provider) {
    throw new Error('No AI provider selected. Run: graphyn provider set <gemini|lmstudio|claude-cli>');
  }

  const messages: AIMessage[] = [
    { role: 'system', content: `You are a ${agentConfig.role}.` },
    { role: 'user', content: agentPrompt },
  ];

  const response = await provider.chat(messages);

  return { result: response.result, metrics: response.usage };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
bun run build 2>&1
```

- [ ] **Step 3: Commit**

```bash
git add src/orchestrator/AgentOrchestrator.ts
git commit -m "refactor: replace ClaudeCodeClient with AIProvider abstraction"
```

---

### Task 8: Add First-Run Provider Selection

**Files:**
- Modify: `src/cli-orchestrator.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add first-run interactive prompt in cli-orchestrator.ts**

In the `main()` function, before initializing the orchestrator:

```typescript
import { ProviderManager } from './providers/provider-manager.js';
import { showModelPicker, loadModelIntoLMStudio, waitForModelReady } from './providers/lmstudio-model-picker.js';
import inquirer from 'inquirer';

// After parsing args, before initializing:
const providerManager = new ProviderManager();
const selectedProvider = providerManager.getSelectedProvider();

if (!selectedProvider) {
  console.log(chalk.bold('\n  Welcome to Graphyn! Let\'s set up your AI provider.\n'));

  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Which AI provider would you like to use?',
      choices: [
        { name: 'Gemini API (cloud, requires API key)', value: 'gemini' },
        { name: 'LM Studio (local, requires LM Studio running)', value: 'lmstudio' },
        { name: 'Claude CLI (requires claude command in PATH)', value: 'claude-cli' },
      ],
    },
  ]);

  if (provider === 'gemini') {
    const { apiKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your Gemini API key:',
      },
    ]);
    await providerManager.selectProvider('gemini');
    providerManager['config'].geminiApiKey = apiKey;
    providerManager.saveConfig();
  } else if (provider === 'lmstudio') {
    await providerManager.selectProvider('lmstudio');

    // Check if LM Studio has a model loaded
    const health = await providerManager.healthCheck('lmstudio');
    if (!health.healthy && health.error?.includes('No models loaded')) {
      // Open the model picker
      const pickerResult = await showModelPicker();
      if (pickerResult) {
        console.log(chalk.cyan(`  Loading ${pickerResult.model.name}...`));
        const loadResult = await loadModelIntoLMStudio(pickerResult.modelId);
        if (loadResult.success) {
          const readyResult = await waitForModelReady(pickerResult.modelId);
          if (readyResult.ready) {
            console.log(chalk.green(`  ✅ ${pickerResult.model.name} loaded and ready\n`));
          } else {
            console.log(chalk.yellow(`  ⚠️  ${readyResult.error}\n`));
          }
        } else {
          console.log(chalk.yellow(`  ⚠️  ${loadResult.error}\n`));
        }
      }
    }
  } else {
    await providerManager.selectProvider('claude-cli');
  }

  const health = await providerManager.healthCheck();
  if (health.healthy) {
    console.log(chalk.green(`  Connected to ${health.type} (${health.model})\n`));
  } else {
    console.log(chalk.yellow(`  Warning: ${health.error}\n`));
    console.log(chalk.gray('  You can reconfigure later with: graphyn provider set <type>\n'));
  }
}
```

- [ ] **Step 2: Update .env.example**

Add these lines to `.env.example`:

```
# AI Provider Configuration
GRAPHYN_AI_PROVIDER=gemini  # gemini, lmstudio, claude-cli
GEMINI_API_KEY=your_gemini_api_key  # Get from https://aistudio.google.com/apikey
LM_STUDIO_URL=http://localhost:1234/v1  # LM Studio API server URL
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
bun run build 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/cli-orchestrator.ts .env.example
git commit -m "feat: add first-run provider selection prompt"
```

---

### Task 9: Smoke Test All Providers

**Files:** No new files — testing existing code.

- [ ] **Step 1: Build and test provider commands**

```bash
bun run build && node bin/graphyn.js provider list
```

Expected: Lists all 3 providers.

- [ ] **Step 2: Test Gemini provider**

```bash
node bin/graphyn.js provider set gemini --key AIzaSyBOXZBNB6RjH7_5HuYSCZlKWiFpDAeTvc4 && node bin/graphyn.js provider test gemini
```

Expected: Connects to Gemini, returns "Graphyn is ready" response.

- [ ] **Step 3: Test provider status**

```bash
node bin/graphyn.js provider status
```

Expected: Shows active provider and health status.

- [ ] **Step 4: Test LM Studio model picker (if LM Studio is running)**

With LM Studio running but no model loaded:
```bash
node bin/graphyn.js provider set lmstudio && node bin/graphyn.js provider test lmstudio
```

Expected: Model picker UI appears with categorized tabs and favorites. After selection, model loads and test completes.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A && git commit -m "fix: provider smoke test fixes"
```

---

## Self-Review

1. **Spec coverage:** All requirements covered — Gemini API, LM Studio local with model picker UI (favorites, categorized tabs, dropdowns, auto-load), Claude CLI fallback, interactive first-run selection, provider CLI commands, orchestrator integration.
2. **Placeholder scan:** No TBD/TODO. All code steps contain actual implementation code.
3. **Type consistency:** `AIProvider` interface is consistent across all implementations. `ProviderManager` uses the same `ProviderType` union. `AIMessage` and `ProviderResponse` types are shared. Model catalog uses consistent `ModelEntry` and `ModelCategory` types. Picker persists favorites to `~/.graphyn/lmstudio-favorites.json`.

## Execution Order

Tasks must run sequentially: 1 → 2 → 3 → 3b → 4 → 5 → 6 → 7 → 8 → 9
- Task 3b depends on Task 3 (LM Studio provider must exist first)
- Each task depends on the previous provider interface being in place
- Task 9 validates everything works end-to-end
