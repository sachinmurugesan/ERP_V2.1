import { ref } from 'vue'

/**
 * Composable for standardized API error handling.
 * Replaces silent catch blocks with user-visible error state.
 */
export function useApiError() {
  const error = ref(null)

  function handleError(err, fallbackMessage = 'An error occurred') {
    const message = err?.response?.data?.detail
      || err?.message
      || fallbackMessage
    error.value = message
    console.error('[API Error]', message)
    return message
  }

  function clearError() {
    error.value = null
  }

  return { error, handleError, clearError }
}
