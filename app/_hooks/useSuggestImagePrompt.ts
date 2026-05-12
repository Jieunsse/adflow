import { useApiMutation } from './useApiMutation'
import type { SuggestImagePromptParams, SuggestImagePromptResult } from '@/lib/gemini-creative'

export type { SuggestImagePromptParams, SuggestImagePromptResult }

export function useSuggestImagePrompt() {
  return useApiMutation<SuggestImagePromptParams, SuggestImagePromptResult>('/api/suggest-image-prompt')
}
