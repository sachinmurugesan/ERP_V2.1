<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../../composables/useAuth'
import { useNotifications } from '../../composables/useNotifications'

const router = useRouter()
const route = useRoute()
const collapsed = ref(false)
const { user, roles, isAdmin, isFinance, isOperations, hasAnyRole, logout } = useAuth()
const { unreadCount, notifications, showNotifDialog, fetchUnreadCount, fetchNotifications, markAsRead, markAllRead, openDialog } = useNotifications()
onMounted(() => { fetchUnreadCount() })

// Notification style map — each type gets icon, color, and target tab
const NOTIF_STYLES = {
  ITEM_QUERY_CREATED:          { icon: 'pi-comments',           bg: 'bg-indigo-100',  text: 'text-indigo-600',  label: 'New Query' },
  ITEM_QUERY_REPLY:            { icon: 'pi-reply',              bg: 'bg-indigo-100',  text: 'text-indigo-600',  label: 'Query Reply' },
  PAYMENT_SUBMITTED:           { icon: 'pi-wallet',             bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Payment' },
  PAYMENT_APPROVED:            { icon: 'pi-check-circle',       bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Payment Verified' },
  PAYMENT_REJECTED:            { icon: 'pi-times-circle',       bg: 'bg-red-100',     text: 'text-red-600',     label: 'Payment Rejected' },
  ORDER_STAGE_CHANGE:          { icon: 'pi-arrow-right',        bg: 'bg-blue-100',    text: 'text-blue-600',    label: 'Stage Update' },
  PRODUCT_REVIEW_REQUEST:      { icon: 'pi-box',                bg: 'bg-amber-100',   text: 'text-amber-600',   label: 'Product Review' },
  PRODUCT_APPROVED:            { icon: 'pi-check',              bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Product Approved' },
  ITEMS_PENDING_APPROVAL:      { icon: 'pi-plus-circle',        bg: 'bg-amber-100',   text: 'text-amber-600',   label: 'Items Added' },
  ITEMS_PENDING_CONFIRMATION:  { icon: 'pi-clock',              bg: 'bg-amber-100',   text: 'text-amber-600',   label: 'Needs Confirmation' },
  ITEMS_CLIENT_CONFIRMED:      { icon: 'pi-thumbs-up',          bg: 'bg-indigo-100',  text: 'text-indigo-600',  label: 'Client Confirmed' },
  ITEMS_APPROVED:              { icon: 'pi-check-circle',       bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Items Approved' },
  ITEM_CONFIRMED:              { icon: 'pi-check',              bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Item Confirmed' },
  PRICES_SENT_FOR_REVIEW:      { icon: 'pi-tag',                bg: 'bg-indigo-100',  text: 'text-indigo-600',  label: 'Prices Sent' },
  PACKING_DECISION:            { icon: 'pi-box',                bg: 'bg-amber-100',   text: 'text-amber-600',   label: 'Packing Update' },
  AFTER_SALES_SUBMIT:          { icon: 'pi-exclamation-triangle', bg: 'bg-rose-100',  text: 'text-rose-600',    label: 'After-Sales' },
}
function notifStyle(n) {
  const type = n.notification_type || n.type
  return NOTIF_STYLES[type] || { icon: 'pi-bell', bg: 'bg-slate-100', text: 'text-slate-600', label: 'Notification' }
}

function handleNotifClick(n) {
  markAsRead(n.id)
  showNotifDialog.value = false
  const type = n.notification_type || n.type
  if (type === 'PRODUCT_REVIEW_REQUEST') {
    router.push('/products/review')
  } else if (['PAYMENT_SUBMITTED', 'PAYMENT_APPROVED', 'PAYMENT_REJECTED'].includes(type) && n.resource_id) {
    router.push(`/orders/${n.resource_id}?tab=payments`)
  } else if (['ITEM_QUERY_CREATED', 'ITEM_QUERY_REPLY'].includes(type) && n.resource_id) {
    // Open the queries tab. Extract query_id from metadata if present
    const qid = n.metadata?.query_id || ''
    router.push(`/orders/${n.resource_id}?tab=queries${qid ? '&query=' + qid : ''}`)
  } else if (['ITEMS_PENDING_APPROVAL', 'ITEMS_PENDING_CONFIRMATION', 'ITEMS_CLIENT_CONFIRMED', 'ITEMS_APPROVED', 'ITEM_CONFIRMED', 'PRICES_SENT_FOR_REVIEW'].includes(type) && n.resource_id) {
    router.push(`/orders/${n.resource_id}?tab=items`)
  } else if (type === 'ORDER_STAGE_CHANGE' && n.resource_id) {
    router.push(`/orders/${n.resource_id}?tab=dashboard`)
  } else if (type === 'PACKING_DECISION' && n.resource_id) {
    router.push(`/orders/${n.resource_id}?tab=packing`)
  } else if (type === 'AFTER_SALES_SUBMIT' && n.resource_id) {
    router.push(`/orders/${n.resource_id}?tab=after-sales`)
  } else if (n.resource_type === 'order' && n.resource_id) {
    router.push(`/orders/${n.resource_id}`)
  }
}

const menuGroups = [
  {
    label: 'MAIN',
    items: [
      { label: 'Dashboard', icon: 'pi pi-home', route: '/dashboard', roles: ['ADMIN', 'FINANCE', 'OPERATIONS', 'VIEWER'] },
      { label: 'Orders', icon: 'pi pi-shopping-cart', route: '/orders', roles: ['ADMIN', 'OPERATIONS', 'FINANCE', 'VIEWER'] },
    ],
  },
  {
    label: 'MASTER DATA',
    items: [
      { label: 'Products', icon: 'pi pi-box', route: '/products', roles: ['ADMIN', 'OPERATIONS', 'VIEWER'] },
      { label: 'Factories', icon: 'pi pi-building', route: '/factories', roles: ['ADMIN', 'OPERATIONS'] },
      { label: 'Clients', icon: 'pi pi-users', route: '/clients', roles: ['ADMIN', 'OPERATIONS', 'FINANCE'] },
      { label: 'Transport', icon: 'pi pi-truck', route: '/transport', roles: ['ADMIN', 'OPERATIONS'] },
    ],
  },
  {
    label: 'TRACKING',
    items: [
      { label: 'After-Sales', icon: 'pi pi-exclamation-triangle', route: '/after-sales', roles: ['ADMIN', 'OPERATIONS'] },
      { label: 'Finance', icon: 'pi pi-chart-line', route: '/finance', roles: ['ADMIN', 'FINANCE'] },
      { label: 'Returns & Pending', icon: 'pi pi-replay', route: '/returns-pending', roles: ['ADMIN', 'OPERATIONS'] },
      { label: 'Warehouse', icon: 'pi pi-warehouse', route: '/warehouse', roles: ['ADMIN', 'OPERATIONS'] },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { label: 'Product Review', icon: 'pi pi-check-square', route: '/products/review', roles: ['ADMIN'] },
      { label: 'Users', icon: 'pi pi-users', route: '/users', roles: ['ADMIN'] },
      { label: 'Settings', icon: 'pi pi-cog', route: '/settings', roles: ['ADMIN'] },
      { label: 'Audit Trail', icon: 'pi pi-list', route: '/audit-logs', roles: ['ADMIN'] },
      { label: 'Tech Stack', icon: 'pi pi-code', route: '/tech-stack', roles: ['ADMIN'] },
    ],
  },
]

// Filter menu groups based on user roles
const filteredMenuGroups = computed(() => {
  return menuGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => hasAnyRole(item.roles)),
    }))
    .filter(group => group.items.length > 0)
})

const userInitials = computed(() => {
  if (!user.value?.email) return 'U'
  return user.value.email.substring(0, 2).toUpperCase()
})

const userDisplayName = computed(() => {
  if (user.value?.full_name) return user.value.full_name
  if (!user.value?.email) return 'User'
  return user.value.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
})

const roleBadge = computed(() => {
  if (!roles.value.length) return null
  const primary = roles.value[0]
  const colors = {
    ADMIN: 'bg-red-500/20 text-red-400',
    FINANCE: 'bg-amber-500/20 text-amber-400',
    OPERATIONS: 'bg-emerald-500/20 text-emerald-400',
    VIEWER: 'bg-slate-500/20 text-slate-400',
  }
  return { label: primary, class: colors[primary] || colors.VIEWER }
})

const isActive = (path) => {
  if (path === '/dashboard') return route.path === '/' || route.path === '/dashboard'
  return route.path.startsWith(path)
}

const navigate = (path) => {
  router.push(path)
}
</script>

<template>
  <aside
    class="bg-slate-800 text-white flex flex-col transition-all duration-300"
    :class="collapsed ? 'w-16' : 'w-64'"
  >
    <!-- Logo -->
    <div class="flex items-center justify-between p-4 border-b border-slate-700">
      <div v-if="!collapsed" class="flex items-center gap-2">
        <span class="text-xl">&#127806;</span>
        <span class="text-lg font-bold text-emerald-400">HarvestERP</span>
      </div>
      <button
        @click="collapsed = !collapsed"
        class="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700"
      >
        <i :class="collapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'" />
      </button>
    </div>

    <!-- Menu Groups -->
    <nav class="flex-1 py-2 overflow-y-auto">
      <div v-for="(group, gIndex) in filteredMenuGroups" :key="gIndex">
        <!-- Group Label -->
        <div
          v-if="!collapsed"
          class="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-4 mb-1 mt-4"
        >
          {{ group.label }}
        </div>

        <!-- Menu Items -->
        <button
          v-for="(item, iIndex) in group.items"
          :key="iIndex"
          @click="navigate(item.route)"
          class="w-full flex items-center gap-3 px-3 py-2.5 mx-auto text-sm transition-colors rounded-lg"
          :class="[
            collapsed ? 'justify-center w-12 mx-auto' : 'mx-2',
            isActive(item.route)
              ? 'bg-emerald-600 text-white'
              : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
          ]"
          :title="collapsed ? item.label : ''"
        >
          <i :class="item.icon" class="text-base w-5 text-center" />
          <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
        </button>
      </div>
    </nav>

    <!-- User Profile Footer -->
    <div class="p-3 border-t border-slate-700">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
          {{ userInitials }}
        </div>
        <div v-if="!collapsed" class="min-w-0 flex-1">
          <div class="text-sm font-medium text-white truncate">{{ userDisplayName }}</div>
          <div v-if="roleBadge" class="flex items-center gap-1 mt-0.5">
            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider" :class="roleBadge.class">
              {{ roleBadge.label }}
            </span>
          </div>
        </div>
        <button v-if="!collapsed" @click="openDialog" class="relative p-1 text-slate-400 hover:text-white transition-colors" title="Notifications">
          <i class="pi pi-bell text-sm" />
          <span v-if="unreadCount > 0" class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
        </button>
        <button
          v-if="!collapsed"
          @click="logout(); router.push('/login')"
          class="text-slate-400 hover:text-red-400 transition-colors p-1 rounded hover:bg-slate-700/50"
          title="Sign out"
        >
          <i class="pi pi-sign-out text-sm" />
        </button>
      </div>
      <button
        v-if="collapsed"
        @click="logout(); router.push('/login')"
        class="w-full mt-2 flex justify-center text-slate-400 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-slate-700/50"
        title="Sign out"
      >
        <i class="pi pi-sign-out text-sm" />
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
            :class="{ 'border-l-4 border-l-indigo-500': !n.is_read }"
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
                    <span v-if="(n.count || 1) > 1" class="text-xs text-indigo-600 font-bold">({{ n.count }})</span>
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
                <span v-if="(n.notification_type || n.type) === 'PRODUCT_REVIEW_REQUEST'" class="inline-flex items-center gap-1 mt-1.5 text-[10px] text-amber-600 font-medium">
                  <i class="pi pi-arrow-right text-[8px]" /> Click to review
                </span>
                <span v-else-if="n.type === 'PAYMENT_SUBMITTED'" class="inline-flex items-center gap-1 mt-1.5 text-[10px] text-indigo-600 font-medium">
                  <i class="pi pi-arrow-right text-[8px]" /> Click to verify payment
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
