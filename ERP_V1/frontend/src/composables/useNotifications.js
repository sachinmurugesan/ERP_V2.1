import { ref } from 'vue'
import axios from 'axios'

const unreadCount = ref(0)
const notifications = ref([])
const showNotifDialog = ref(false)
const loading = ref(false)

// Module-level polling state (singleton across component instances)
let pollIntervalId = null
let pollingStarted = false

async function pollFetchCount() {
  try {
    const { data } = await axios.get('/api/notifications/count/')
    unreadCount.value = data.unread_count || 0
    // If dialog is open, also refresh the list so new notifications appear live
    if (showNotifDialog.value) {
      const { data: listData } = await axios.get('/api/notifications/')
      notifications.value = listData.notifications || []
    }
  } catch (_e) { /* ignore */ }
}

function startNotificationPolling() {
  if (pollingStarted) return
  pollingStarted = true
  // Initial fetch immediately
  pollFetchCount()
  // Then every 10 seconds
  pollIntervalId = setInterval(pollFetchCount, 10000)
  // Refetch when tab regains focus
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('focus', pollFetchCount)
}

function stopNotificationPolling() {
  if (pollIntervalId) { clearInterval(pollIntervalId); pollIntervalId = null }
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('focus', pollFetchCount)
  pollingStarted = false
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') pollFetchCount()
}

export function useNotifications() {
  async function fetchUnreadCount() {
    await pollFetchCount()
    startNotificationPolling()
  }

  async function fetchNotifications() {
    loading.value = true
    try {
      const { data } = await axios.get('/api/notifications/')
      notifications.value = data.notifications || []
      unreadCount.value = data.unread_count || 0
    } catch (_e) { notifications.value = [] }
    loading.value = false
  }

  async function markAsRead(id) {
    try {
      await axios.put(`/api/notifications/${id}/read/`)
      notifications.value = notifications.value.filter(n => n.id !== id)
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    } catch (_e) { /* ignore */ }
  }

  async function markAllRead() {
    try {
      await axios.put('/api/notifications/read-all/')
      notifications.value = []
      unreadCount.value = 0
    } catch (_e) { /* ignore */ }
  }

  async function markReadByResource(resourceType, resourceId, notificationType = null) {
    try {
      const params = new URLSearchParams({ resource_type: resourceType, resource_id: resourceId })
      if (notificationType) params.append('notification_type', notificationType)
      const { data } = await axios.put(`/api/notifications/mark-read-by-resource/?${params}`)
      if (data.marked_read > 0) {
        unreadCount.value = Math.max(0, unreadCount.value - data.marked_read)
        notifications.value = notifications.value.filter(n =>
          !(n.resource_type === resourceType && n.resource_id === resourceId &&
            (!notificationType || n.notification_type === notificationType))
        )
      }
    } catch (_e) { /* ignore */ }
  }

  function openDialog() {
    fetchNotifications()
    showNotifDialog.value = true
  }

  return {
    unreadCount, notifications, showNotifDialog,
    fetchUnreadCount, fetchNotifications, markAsRead, markAllRead, markReadByResource, openDialog,
    startNotificationPolling, stopNotificationPolling,
  }
}
