import { ref, computed } from 'vue'
import axios from 'axios'

const user = ref(null)
const token = ref(localStorage.getItem('harvesterp_token') || null)
const loading = ref(false)
const initialized = ref(false)

// Set axios default auth header if token exists
if (token.value) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
}

// ---------------------------------------------------------------------------
// Axios 401 Interceptor: auto-logout on expired/invalid tokens
// ---------------------------------------------------------------------------
let _interceptorInstalled = false
function _install401Interceptor() {
  if (_interceptorInstalled) return
  _interceptorInstalled = true

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        const url = error.config?.url || ''
        // Don't auto-logout on login attempts
        if (!url.includes('/auth/login')) {
          _clearSession()
          // Redirect to login with session_expired flag
          if (window.location.pathname !== '/login') {
            window.location.href = '/login?session_expired=true'
          }
        }
      }
      return Promise.reject(error)
    }
  )
}

function _clearSession() {
  token.value = null
  user.value = null
  initialized.value = false
  localStorage.removeItem('harvesterp_token')
  localStorage.removeItem('harvesterp_refresh')
  delete axios.defaults.headers.common['Authorization']
}

// Install interceptor immediately
_install401Interceptor()

export function useAuth() {
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'ADMIN' || user.value?.role === 'SUPER_ADMIN')
  const isSuperAdmin = computed(() => user.value?.role === 'SUPER_ADMIN')
  const userRole = computed(() => user.value?.role || '')
  const userType = computed(() => user.value?.user_type || 'INTERNAL')

  // Backward-compatible: roles array derived from user.role
  const roles = computed(() => {
    if (!user.value) return []
    if (user.value.roles) return user.value.roles
    return [user.value.role]
  })
  const isFinance = computed(() => isAdmin.value || roles.value.includes('FINANCE'))
  const isOperations = computed(() => isAdmin.value || roles.value.includes('OPERATIONS'))

  /**
   * Get the portal redirect path for the current user type.
   */
  function getPortalPath() {
    if (!user.value) return '/login'
    switch (user.value.user_type) {
      case 'CLIENT': return '/client-portal'
      case 'FACTORY': return '/factory-portal'
      default: return '/dashboard'
    }
  }

  async function login(email, password) {
    loading.value = true
    try {
      const { data } = await axios.post('/api/auth/login', { email, password }, { withCredentials: true })
      token.value = data.access_token
      user.value = data.user
      initialized.value = true
      localStorage.setItem('harvesterp_token', data.access_token)
      // Refresh token is now in httpOnly cookie — NOT stored in localStorage
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`
      return data
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await axios.post('/api/auth/logout', {}, { withCredentials: true })
    } catch (_) { /* ignore */ }
    _clearSession()
  }

  /**
   * Restore session on page refresh.
   * Checks if token exists, fetches user profile, clears if invalid.
   * Returns the user or null.
   */
  async function restoreSession() {
    if (initialized.value && user.value) return user.value
    if (!token.value) {
      initialized.value = true
      return null
    }

    loading.value = true
    try {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
      const { data } = await axios.get('/api/auth/me')
      user.value = data
      initialized.value = true
      return data
    } catch (e) {
      _clearSession()
      initialized.value = true
      return null
    } finally {
      loading.value = false
    }
  }

  async function fetchUser() {
    return restoreSession()
  }

  function hasRole(role) {
    if (!user.value) return false
    if (user.value.role === 'ADMIN') return true
    return user.value.role === role || (user.value.roles || []).includes(role)
  }

  function hasAnyRole(roleList) {
    if (!user.value) return false
    if (user.value.role === 'ADMIN' || user.value.role === 'SUPER_ADMIN') return true
    return roleList.some(r => user.value.role === r || (user.value.roles || []).includes(r))
  }

  return {
    user,
    token,
    loading,
    initialized,
    isAdmin,
    isSuperAdmin,
    isFinance,
    isOperations,
    roles,
    login,
    logout,
    restoreSession,
    getPortalPath,
    hasAnyRole,
  }
}
