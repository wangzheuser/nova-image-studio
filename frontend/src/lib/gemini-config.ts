export type OutputSize = 'auto' | '512' | '1K' | '2K' | '4K';
export type AspectRatio = 'auto' | '1:1' | '1:4' | '1:8' | '2:3' | '3:2' | '3:4' | '4:1' | '4:3' | '4:5' | '5:4' | '8:1' | '9:16' | '16:9' | '21:9';

export type ModelId = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview' | 'gemini-3.1-flash-image-preview' | 'gpt-image-2' | 'gpt-image-2-fast' | 'gpt-image-2-plus' | 'gpt-image-2-pro';

export const MODEL_OPTIONS: { value: ModelId; label: string }[] = [
  { value: 'gemini-2.5-flash-image', label: 'Banana' },
  { value: 'gemini-3-pro-image-preview', label: 'Banana Pro' },
  { value: 'gemini-3.1-flash-image-preview', label: 'Banana 2' },
  { value: 'gpt-image-2', label: 'GPT Image 2' },
  { value: 'gpt-image-2-fast', label: 'GPT Image 2 Fast' },
  { value: 'gpt-image-2-plus', label: 'GPT Image 2 Plus' },
  { value: 'gpt-image-2-pro', label: 'GPT Image 2 Pro' },
];

const GPT_IMAGE_MODELS: ModelId[] = ['gpt-image-2', 'gpt-image-2-fast', 'gpt-image-2-plus', 'gpt-image-2-pro'];

export function isGptImageModel(model: ModelId): boolean {
  return GPT_IMAGE_MODELS.includes(model);
}

export const MODEL_IMAGE_LIMITS: Record<ModelId, { max: number; description: string }> = {
  'gemini-2.5-flash-image': {
    max: 3,
    description: '最多 3 张参考图片',
  },
  'gemini-3-pro-image-preview': {
    max: 11,
    description: '最多 11 张参考图片（6 张物品保真 + 5 张角色一致性）',
  },
  'gemini-3.1-flash-image-preview': {
    max: 14,
    description: '最多 14 张参考图片（10 张物品保真 + 4 张角色一致性）',
  },
  'gpt-image-2': {
    max: 6,
    description: '最多 6 张参考图片',
  },
  'gpt-image-2-fast': {
    max: 6,
    description: '最多 6 张参考图片',
  },
  'gpt-image-2-plus': {
    max: 10,
    description: '最多 10 张参考图片',
  },
  'gpt-image-2-pro': {
    max: 16,
    description: '最多 16 张参考图片',
  },
};

// ===== Token 模型变体 =====
// Token 模型与原模型功能完全一致，仅 ID/name 不同
// 后端会将 -tokens 后缀的模型直接发送给 nova API

export const TOKEN_SUFFIX = '-tokens';

/** 支持 Token 变体的模型列表 */
export const TOKEN_SUPPORTED_MODELS: ModelId[] = [
  'gemini-2.5-flash-image',
  'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview',
  'gpt-image-2-pro',
];

/** 判断给定模型 ID 是否支持 Token 模式 */
export function supportsTokenMode(modelId: string): boolean {
  const base = stripTokenSuffix(modelId);
  return TOKEN_SUPPORTED_MODELS.includes(base as ModelId);
}

/** 去掉 -tokens 后缀，返回基础模型 ID */
export function stripTokenSuffix(modelId: string): string {
  return modelId.endsWith(TOKEN_SUFFIX) ? modelId.slice(0, -TOKEN_SUFFIX.length) : modelId;
}

/** 判断是否为 Token 变体模型 */
export function isTokenModel(modelId: string): boolean {
  return modelId.endsWith(TOKEN_SUFFIX);
}

/** 从基础模型 ID 生成对应的 Token 模型 ID */
export function getTokenModelId(modelId: ModelId): string {
  return `${modelId}${TOKEN_SUFFIX}`;
}

/** 从可能带 -tokens 后缀的 ID 还原为基础 ModelId */
export function getBaseModelId(modelId: string): ModelId {
  return stripTokenSuffix(modelId) as ModelId;
}

/** 用于检测区域展示的 token 模型选项列表 */
export const TOKEN_MODEL_OPTIONS: { value: string; label: string }[] = TOKEN_SUPPORTED_MODELS.map((id) => ({
  value: getTokenModelId(id),
  label: `${MODEL_OPTIONS.find((o) => o.value === id)?.label || id}（按量计费）`,
}));