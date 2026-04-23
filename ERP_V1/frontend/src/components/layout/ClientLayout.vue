<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authApi } from '../../api'
import { useAuth } from '../../composables/useAuth'
import { useNotifications } from '../../composables/useNotifications'

const route = useRoute()
const router = useRouter()
const { user, logout } = useAuth()
const { unreadCount, notifications, showNotifDialog, fetchUnreadCount, fetchNotifications, markAsRead, markAllRead, openDialog } = useNotifications()
const collapsed = ref(false)
const portalPerms = ref({})

onMounted(async () => {
  fetchUnreadCount()
  // Load portal permissions
  try {
    const { data } = await authApi.getMe()
    portalPerms.value = data.portal_permissions || {}
  } catch (_) { /* ignore */ }
})

const NOTIF_STYLES = {
  ITEM_QUERY_CREATED:          { icon: 'pi-comments',     bg: 'bg-indigo-100',  text: 'text-indigo-600',  label: 'New Query' },
  ITEM_QUERY_REPLY:            { icon: 'pi-reply',        bg: 'bg-indigo-100',  text: 'text-indigo-600',  label: 'Query Reply' },
  PAYMENT_SUBMITTED:           { icon: 'pi-wallet',       bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Payment' },
  PAYMENT_APPROVED:            { icon: 'pi-check-circle', bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Verified' },
  PAYMENT_REJECTED:            { icon: 'pi-times-circle', bg: 'bg-red-100',     text: 'text-red-600',     label: 'Rejected' },
  ORDER_STAGE_CHANGE:          { icon: 'pi-arrow-right',  bg: 'bg-blue-100',    text: 'text-blue-600',    label: 'Stage Update' },
  PRODUCT_APPROVED:            { icon: 'pi-check',        bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Approved' },
  ITEMS_PENDING_CONFIRMATION:  { icon: 'pi-clock',        bg: 'bg-amber-100',   text: 'text-amber-600',   label: 'Needs Action' },
  ITEMS_APPROVED:              { icon: 'pi-check-circle', bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Items Added' },
  PRICES_SENT_FOR_REVIEW:      { icon: 'pi-tag',          bg: 'bg-indigo-100',  text: 'text-indigo-600',  label: 'Prices Ready' },
  PACKING_DECISION:            { icon: 'pi-box',          bg: 'bg-amber-100',   text: 'text-amber-600',   label: 'Packing' },
}
function notifStyle(n) {
  const type = n.notification_type || n.type
  return NOTIF_STYLES[type] || { icon: 'pi-bell', bg: 'bg-slate-100', text: 'text-slate-600', label: 'Update' }
}

function handleNotifClick(n) {
  markAsRead(n.id)
  showNotifDialog.value = false
  const type = n.notification_type || n.type
  if (['ITEM_QUERY_CREATED', 'ITEM_QUERY_REPLY'].includes(type) && n.resource_id) {
    const qid = n.metadata?.query_id || ''
    router.push(`/client-portal/orders/${n.resource_id}?tab=queries${qid ? '&query=' + qid : ''}`)
  } else if (['PAYMENT_SUBMITTED', 'PAYMENT_APPROVED', 'PAYMENT_REJECTED'].includes(type) && n.resource_id) {
    router.push(`/client-portal/orders/${n.resource_id}?tab=payments`)
  } else if (['ITEMS_PENDING_CONFIRMATION', 'ITEMS_APPROVED', 'PRICES_SENT_FOR_REVIEW'].includes(type) && n.resource_id) {
    router.push(`/client-portal/orders/${n.resource_id}?tab=items`)
  } else if (type === 'PACKING_DECISION' && n.resource_id) {
    router.push(`/client-portal/orders/${n.resource_id}?tab=packing`)
  } else if (type === 'ORDER_STAGE_CHANGE' && n.resource_id) {
    router.push(`/client-portal/orders/${n.resource_id}`)
  } else if (n.resource_id) {
    router.push(`/client-portal/orders/${n.resource_id}`)
  }
}

const menuItems = computed(() => {
  const items = [
    { label: 'Dashboard', icon: 'pi pi-home', route: '/client-portal' },
    { label: 'Products', icon: 'pi pi-box', route: '/client-portal/products' },
    { label: 'My Orders', icon: 'pi pi-shopping-cart', route: '/client-portal/orders' },
  ]
  if (portalPerms.value.show_payments)
    items.push({ label: 'Ledger', icon: 'pi pi-wallet', route: '/client-portal/ledger' })
  if (portalPerms.value.show_shipping)
    items.push({ label: 'Shipments', icon: 'pi pi-truck', route: '/client-portal/shipments' })
  if (portalPerms.value.show_after_sales)
    items.push({ label: 'After-Sales', icon: 'pi pi-exclamation-triangle', route: '/client-portal/after-sales' })
  items.push({ label: 'Returns & Pending', icon: 'pi pi-replay', route: '/client-portal/returns-pending' })
  items.push({ label: 'Profile', icon: 'pi pi-user', route: '/client-portal/profile' })
  return items
})

function isActive(path) {
  if (path === '/client-portal') return route.path === '/client-portal'
  return route.path.startsWith(path)
}

function handleLogout() {
  logout()
  router.push('/login')
}
</script>

<template>
  <div class="flex h-screen bg-gray-50">
    <!-- Sidebar -->
    <aside class="bg-gradient-to-b from-emerald-800 to-emerald-900 text-white flex flex-col transition-all duration-300"
      :class="collapsed ? 'w-16' : 'w-56'">
      <!-- Logo -->
      <div class="flex items-center gap-3 px-4 py-4 border-b border-emerald-700/50">
        <div class="w-8 h-8 rounded-lg bg-emerald-400/20 flex items-center justify-center text-emerald-300 flex-shrink-0">
          <i class="pi pi-box text-sm" />
        </div>
        <span v-if="!collapsed" class="text-sm font-bold tracking-wide">Client Portal</span>
      </div>

      <!-- Menu -->
      <nav class="flex-1 py-3 space-y-0.5 px-2">
        <router-link
          v-for="item in menuItems"
          :key="item.route"
          :to="item.route"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
          :class="isActive(item.route)
            ? 'bg-emerald-700/60 text-white font-medium'
            : 'text-emerald-200 hover:bg-emerald-700/30 hover:text-white'"
        >
          <i :class="item.icon" class="text-sm flex-shrink-0" />
          <span v-if="!collapsed">{{ item.label }}</span>
        </router-link>
      </nav>

      <!-- User -->
      <div class="border-t border-emerald-700/50 p-3">
        <div v-if="!collapsed" class="flex items-center justify-between mb-2">
          <div class="text-xs text-emerald-300 truncate">
            {{ user?.full_name || user?.email }}
          </div>
          <button @click="openDialog" class="relative p-1 text-emerald-300 hover:text-white transition-colors" title="Notifications">
            <i class="pi pi-bell text-sm" />
            <span v-if="unreadCount > 0" class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
          </button>
        </div>
        <button @click="handleLogout" class="flex items-center gap-2 text-emerald-300 hover:text-white text-xs w-full px-2 py-1.5 rounded hover:bg-emerald-700/30">
          <i class="pi pi-sign-out text-xs" />
          <span v-if="!collapsed">Sign out</span>
        </button>
      </div>

      <!-- Notification Dialog -->
      <div v-if="showNotifDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showNotifDialog = false">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[70vh] flex flex-col">
          <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
            <h2 class="text-lg font-bold text-slate-800">Notifications</h2>
            <div class="flex items-center gap-2">
              <button v-if="notifications.length > 0" @click="markAllRead" class="text-xs text-blue-600 hover:text-blue-800">Mark all read</button>
              <button @click="showNotifDialog = false" class="text-slate-400 hover:text-slate-600"><i class="pi pi-times" /></button>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto">
            <div v-if="notifications.length === 0" class="py-12 text-center text-slate-400">
              <i class="pi pi-bell text-2xl mb-2" />
              <p class="text-sm">No new notifications</p>
            </div>
            <div v-for="n in notifications" :key="n.id"
              class="px-5 py-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
              :class="{ 'border-l-4 border-l-teal-500': !n.is_read }"
              @click="handleNotifClick(n)">
              <div class="flex items-start gap-3">
                <div class="relative flex-shrink-0">
                  <div class="w-10 h-10 rounded-full flex items-center justify-center ring-2 ring-white shadow-sm" :class="notifStyle(n).bg">
                    <i :class="['pi', notifStyle(n).icon, notifStyle(n).text]" class="text-sm" />
                  </div>
                  <span v-if="(n.count || 1) > 1"
                    class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                    {{ n.count > 99 ? '99+' : n.count }}
                  </span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2 mb-0.5">
                    <p class="text-sm font-semibold text-slate-800 truncate">
                      {{ n.title }}
                      <span v-if="(n.count || 1) > 1" class="text-xs text-teal-600 font-bold">({{ n.count }})</span>
                    </p>
                    <span class="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide flex-shrink-0" :class="[notifStyle(n).bg, notifStyle(n).text]">
                      {{ notifStyle(n).label }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-600 line-clamp-2">{{ n.message }}</p>
                  <p class="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <i class="pi pi-clock text-[9px]" />
                    {{ n.created_at ? new Date(n.created_at).toLocaleString() : '' }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto">
      <router-view />
    </main>
  </div>
</template>
