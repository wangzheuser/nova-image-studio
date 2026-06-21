'use client';

// Nova Image 模型注册表
// 用户自定义模型配置，存储在浏览器 localStorage
// 后端不校验模型名，前端负责将完整配置传递给后端

// ===== 提供商协议 =====

export type ProviderProtocol = 'google' | 'openai';

// ===== 提供商设置 =====

export interface ProviderSettings {
  protocol: ProviderProtocol;
  apiKey: string;
  baseUrl: string;
}

export interface ProviderRegistry {
  google: ProviderSettings;
  openai: ProviderSettings;
}

// ===== 图像模型配置 =====

export interface ImageModelConfig {
  id: string;
  protocol: ProviderProtocol;
  name: string;
  modelId: string;
  maxRefImages: number;
  supportedAspectRatios: string[];
  supportedOutputSizes: string[];
  supportsCustomSize: boolean;
  supportsTemperature: boolean;
  supportsAdvancedParams: boolean;
}

// ===== 文字模型配置 =====

export interface TextModelConfig {
  id: string;
  protocol: ProviderProtocol;
  name: string;
  modelId: string;
  note?: string;
}

// ===== 任务默认模型映射 =====

export interface DefaultModels {
  textToImage: string;
  imageToImage: string;
  reversePrompt: string;
  agent: string;
  promptOptimize: string;
  imageDescribe: string;
}

// ===== 完整注册表 =====

export interface NovaModelRegistry {
  providers: ProviderRegistry;
  imageModels: ImageModelConfig[];
  textModels: TextModelConfig[];
  defaults: DefaultModels;
}

// ===== 存储键 =====

const REGISTRY_KEY = 'nova-model-registry';

// ===== 默认值 =====

const DEFAULT_PROVIDERS: ProviderRegistry = {
  google: {
    protocol: 'google',
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com',
  },
  openai: {
    protocol: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com',
  },
};

const DEFAULT_IMAGE_MODELS: ImageModelConfig[] = [
  {
    id: 'gemini-2.5-flash-image',
    protocol: 'google',
    name: 'Gemini 2.5 Flash Image',
    modelId: 'gemini-2.5-flash-image',
    maxRefImages: 3,
    supportedAspectRatios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    supportedOutputSizes: ['1K'],
    supportsCustomSize: false,
    supportsTemperature: true,
    supportsAdvancedParams: false,
  },
  {
    id: 'gemini-3-pro-image-preview',
    protocol: 'google',
    name: 'Gemini 3 Pro Image',
    modelId: 'gemini-3-pro-image-preview',
    maxRefImages: 11,
    supportedAspectRatios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    supportedOutputSizes: ['1K', '2K', '4K'],
    supportsCustomSize: false,
    supportsTemperature: true,
    supportsAdvancedParams: false,
  },
  {
    id: 'gpt-image-1',
    protocol: 'openai',
    name: 'GPT Image 1',
    modelId: 'gpt-image-1',
    maxRefImages: 6,
    supportedAspectRatios: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'],
    supportedOutputSizes: ['1K'],
    supportsCustomSize: false,
    supportsTemperature: false,
    supportsAdvancedParams: false,
  },
];

const DEFAULT_TEXT_MODELS: TextModelConfig[] = [
  {
    id: 'gpt-4o-mini',
    protocol: 'openai',
    name: 'GPT 4o Mini',
    modelId: 'gpt-4o-mini',
    note: 'OpenAI 仅兼容 Response 协议',
  },
  {
    id: 'gemini-2.5-flash',
    protocol: 'google',
    name: 'Gemini 2.5 Flash',
    modelId: 'gemini-2.5-flash',
  },
];

const DEFAULT_DEFAULTS: DefaultModels = {
  textToImage: 'gemini-3-pro-image-preview',
  imageToImage: 'gemini-3-pro-image-preview',
  reversePrompt: 'gpt-4o-mini',
  agent: 'gpt-4o-mini',
  promptOptimize: 'gpt-4o-mini',
  imageDescribe: 'gpt-4o-mini',
};

// ===== 读写函数 =====

export function loadRegistry(): NovaModelRegistry {
  if (typeof window === 'undefined') {
    return {
      providers: DEFAULT_PROVIDERS,
      imageModels: DEFAULT_IMAGE_MODELS,
      textModels: DEFAULT_TEXT_MODELS,
      defaults: DEFAULT_DEFAULTS,
    };
  }
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as NovaModelRegistry;
      // 合并默认值，防止缺少字段
      return {
        providers: { ...DEFAULT_PROVIDERS, ...parsed.providers },
        imageModels: Array.isArray(parsed.imageModels) ? parsed.imageModels : DEFAULT_IMAGE_MODELS,
        textModels: Array.isArray(parsed.textModels) ? parsed.textModels : DEFAULT_TEXT_MODELS,
        defaults: { ...DEFAULT_DEFAULTS, ...parsed.defaults },
      };
    }
  } catch {
    // ignore
  }
  // 首次使用，写入默认值
  const initial: NovaModelRegistry = {
    providers: DEFAULT_PROVIDERS,
    imageModels: DEFAULT_IMAGE_MODELS,
    textModels: DEFAULT_TEXT_MODELS,
    defaults: DEFAULT_DEFAULTS,
  };
  saveRegistry(initial);
  return initial;
}

export function saveRegistry(registry: NovaModelRegistry): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // ignore storage errors
  }
}

// ===== 便捷查询 =====

export function getProviderSettings(registry: NovaModelRegistry, protocol: ProviderProtocol): ProviderSettings {
  return registry.providers[protocol];
}

export function getImageModelById(registry: NovaModelRegistry, id: string): ImageModelConfig | undefined {
  return registry.imageModels.find(m => m.id === id);
}

export function getTextModelById(registry: NovaModelRegistry, id: string): TextModelConfig | undefined {
  return registry.textModels.find(m => m.id === id);
}

export function getDefaultImageModel(registry: NovaModelRegistry, task: keyof Pick<DefaultModels, 'textToImage' | 'imageToImage'>): ImageModelConfig | undefined {
  return getImageModelById(registry, registry.defaults[task]);
}

export function getDefaultTextModel(registry: NovaModelRegistry, task: keyof Pick<DefaultModels, 'reversePrompt' | 'agent' | 'promptOptimize' | 'imageDescribe'>): TextModelConfig | undefined {
  return getTextModelById(registry, registry.defaults[task]);
}

export function getProviderForImageModel(registry: NovaModelRegistry, modelId: string): { provider: ProviderSettings; model: ImageModelConfig } | undefined {
  const model = getImageModelById(registry, modelId);
  if (!model) return undefined;
  return { provider: getProviderSettings(registry, model.protocol), model };
}

export function getProviderForTextModel(registry: NovaModelRegistry, modelId: string): { provider: ProviderSettings; model: TextModelConfig } | undefined {
  const model = getTextModelById(registry, modelId);
  if (!model) return undefined;
  return { provider: getProviderSettings(registry, model.protocol), model };
}

// ===== ID 生成 =====

export function generateModelId(): string {
  return `model_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
