// Temporary mini-program rollout switch. Backend and other clients remain independently configured.
export const KNOWLEDGE_ENABLED = false
// Enable only after the corresponding backend routes/schema have been deployed.
export const TOOL_CLOUD_ENABLED = import.meta.env.VITE_TOOL_CLOUD_ENABLED === 'true'
export const NAME_LIBRARY_CLOUD_ENABLED = import.meta.env.VITE_NAME_LIBRARY_CLOUD_ENABLED === 'true'
// Enable only after the tool AI route, privacy disclosure and provider fallback are deployed.
export const TOOL_AI_ENABLED = import.meta.env.VITE_TOOL_AI_ENABLED === 'true'
export const NAME_EVALUATION_AI_ENABLED = import.meta.env.VITE_NAME_EVALUATION_AI_ENABLED === 'true'
// The backend queue, approved template and independent worker must all be ready before enabling.
export const WECHAT_SUBSCRIBE_ENABLED = import.meta.env.VITE_WECHAT_SUBSCRIBE_ENABLED === 'true'
export const WECHAT_SUBSCRIBE_TEMPLATE_ID = String(import.meta.env.VITE_WECHAT_SUBSCRIBE_TEMPLATE_ID || '')
