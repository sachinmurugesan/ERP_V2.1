<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from './composables/useAuth'
import Sidebar from './components/layout/Sidebar.vue'
import Topbar from './components/layout/Topbar.vue'

const route = useRoute()
const { user, initialized, restoreSession, loading } = useAuth()

// Restore session on app mount (handles page refresh)
onMounted(async () => {
  await restoreSession()
})

// Determine which layout to use based on current route
const isPublicRoute = computed(() => route.meta.public === true)
const isPortalRoute = computed(() =>
  route.path.startsWith('/client-portal') || route.path.startsWith('/factory-portal')
)
const showAdminLayout = computed(() =>
  !isPublicRoute.value && !isPortalRoute.value && initialized.value && !!user.value
)
</script>

<template>
  <!-- Loading spinner while restoring session or before redirect to login -->
  <div v-if="(!initialized || (!user && !isPublicRoute && !isPortalRoute)) && !route.meta.public" class="h-screen flex items-center justify-center bg-slate-100">
    <div class="text-center">
      <i class="pi pi-spinner pi-spin text-3xl text-emerald-600 mb-3" />
      <p class="text-sm text-slate-500">Loading...</p>
    </div>
  </div>

  <!-- Public routes (Login) — no layout wrapper -->
  <router-view v-else-if="isPublicRoute" />

  <!-- Portal routes (Client/Factory) — use their own layout -->
  <router-view v-else-if="isPortalRoute" />

  <!-- Admin layout (Internal users) -->
  <div v-else class="flex h-screen bg-slate-100">
    <Sidebar />
    <div class="flex-1 flex flex-col overflow-hidden">
      <Topbar />
      <main class="flex-1 overflow-y-auto p-6">
        <router-view />
      </main>
    </div>
  </div>
</template>
