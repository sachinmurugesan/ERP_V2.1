<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../../composables/useAuth'

const route = useRoute()
const router = useRouter()
const { user, logout } = useAuth()
const mobileMenuOpen = ref(false)

const menuItems = [
  { label: 'Dashboard', icon: 'pi pi-home', route: '/factory-portal' },
  { label: 'Orders', icon: 'pi pi-shopping-cart', route: '/factory-portal/orders' },
  { label: 'Production', icon: 'pi pi-cog', route: '/factory-portal/production' },
  { label: 'Packing', icon: 'pi pi-box', route: '/factory-portal/packing' },
  { label: 'Profile', icon: 'pi pi-user', route: '/factory-portal/profile' },
]

function isActive(path) {
  if (path === '/factory-portal') return route.path === '/factory-portal'
  return route.path.startsWith(path)
}

function handleLogout() {
  logout()
  router.push('/login')
}

function navTo(path) {
  router.push(path)
  mobileMenuOpen.value = false
}
</script>

<template>
  <div class="flex h-screen bg-gray-50">
    <!-- Mobile Header -->
    <div class="md:hidden fixed top-0 left-0 right-0 z-30 bg-gradient-to-r from-indigo-800 to-indigo-900 text-white px-4 py-3 flex items-center justify-between shadow-lg">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-indigo-400/20 flex items-center justify-center text-indigo-300">
          <i class="pi pi-cog text-xs" />
        </div>
        <span class="text-sm font-bold">Factory Portal</span>
      </div>
      <button @click="mobileMenuOpen = !mobileMenuOpen" class="p-1">
        <i :class="mobileMenuOpen ? 'pi pi-times' : 'pi pi-bars'" />
      </button>
    </div>

    <!-- Mobile Menu Overlay -->
    <div v-if="mobileMenuOpen" class="md:hidden fixed inset-0 z-20 bg-black/50" @click="mobileMenuOpen = false" />
    <div v-if="mobileMenuOpen" class="md:hidden fixed top-12 left-0 right-0 z-25 bg-indigo-900 shadow-xl">
      <nav class="py-2 px-3 space-y-1">
        <button v-for="item in menuItems" :key="item.route" @click="navTo(item.route)"
          class="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-left"
          :class="isActive(item.route) ? 'bg-indigo-700/60 text-white font-medium' : 'text-indigo-200'">
          <i :class="item.icon" class="text-sm" />
          {{ item.label }}
        </button>
        <button @click="handleLogout" class="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-indigo-300 mt-2 border-t border-indigo-700 pt-3">
          <i class="pi pi-sign-out text-sm" /> Sign out
        </button>
      </nav>
    </div>

    <!-- Desktop Sidebar -->
    <aside class="hidden md:flex bg-gradient-to-b from-indigo-800 to-indigo-900 text-white flex-col w-52">
      <div class="flex items-center gap-3 px-4 py-4 border-b border-indigo-700/50">
        <div class="w-8 h-8 rounded-lg bg-indigo-400/20 flex items-center justify-center text-indigo-300 flex-shrink-0">
          <i class="pi pi-cog text-sm" />
        </div>
        <span class="text-sm font-bold tracking-wide">Factory Portal</span>
      </div>

      <nav class="flex-1 py-3 space-y-0.5 px-2">
        <router-link v-for="item in menuItems" :key="item.route" :to="item.route"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
          :class="isActive(item.route) ? 'bg-indigo-700/60 text-white font-medium' : 'text-indigo-200 hover:bg-indigo-700/30 hover:text-white'">
          <i :class="item.icon" class="text-sm flex-shrink-0" />
          {{ item.label }}
        </router-link>
      </nav>

      <div class="border-t border-indigo-700/50 p-3">
        <div class="text-xs text-indigo-300 mb-2 truncate">{{ user?.full_name || user?.email }}</div>
        <button @click="handleLogout" class="flex items-center gap-2 text-indigo-300 hover:text-white text-xs w-full px-2 py-1.5 rounded hover:bg-indigo-700/30">
          <i class="pi pi-sign-out text-xs" />
          Sign out
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto pt-12 md:pt-0">
      <router-view />
    </main>
  </div>
</template>
