<script setup>
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const tabs = [
  { label: 'Receivables', route: '/finance/receivables', icon: 'pi pi-indian-rupee' },
  { label: 'Client Ledger', route: '/finance/client-ledger', icon: 'pi pi-users' },
  { label: 'Factory Ledger', route: '/finance/factory-ledger', icon: 'pi pi-building' },
]

const isActive = (path) => route.path === path
</script>

<template>
  <div class="space-y-0">
    <!-- Finance Header with gradient -->
    <div class="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 rounded-t-xl px-6 py-4">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white flex items-center gap-3">
            <i class="pi pi-chart-line" />
            Finance
          </h1>
          <p class="text-blue-100 text-sm mt-1">Receivables, ledgers & statements</p>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="flex gap-1 mt-4 -mb-4">
        <button
          v-for="tab in tabs"
          :key="tab.route"
          @click="router.push(tab.route)"
          class="px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all"
          :class="isActive(tab.route)
            ? 'bg-white text-indigo-700 shadow-sm'
            : 'text-blue-100 hover:text-white hover:bg-white/10'"
        >
          <i :class="tab.icon" class="mr-2 text-xs" />
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Content Area -->
    <div class="bg-white rounded-b-xl shadow-sm min-h-[500px]">
      <router-view />
    </div>
  </div>
</template>
