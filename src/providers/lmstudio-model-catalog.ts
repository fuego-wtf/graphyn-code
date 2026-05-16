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
