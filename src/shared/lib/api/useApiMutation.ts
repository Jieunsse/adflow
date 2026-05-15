import { useMutation } from '@tanstack/react-query'

export function useApiMutation<TParams, TResult>(endpoint: string) {
  return useMutation({
    mutationFn: async (params: TParams): Promise<TResult> => {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const data = await res.json()
      if (!res.ok) throw new Error((data as { error?: string }).error ?? '알 수 없는 오류')
      return data as TResult
    },
  })
}
