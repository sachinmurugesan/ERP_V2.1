<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const pageTitle = computed(() => route.meta.title || 'HarvestERP')

const breadcrumbs = computed(() => {
  const crumbs = [{ label: 'Home', path: '/' }]
  if (route.meta.parent) {
    const parentRoute = route.matched.find(r => r.name === route.meta.parent)
    if (parentRoute) {
      crumbs.push({ label: parentRoute.meta.title, path: parentRoute.path })
    }
  }
  crumbs.push({ label: route.meta.title, path: route.path })
  return crumbs
})
</script>

<template>
  <header class="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
    <!-- Left: Page Title + Breadcrumb -->
    <div>
      <h1 class="text-xl font-semibold text-slate-800">{{ pageTitle }}</h1>
      <nav class="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
        <template v-for="(crumb, i) in breadcrumbs" :key="i">
          <span v-if="i > 0" class="mx-1">/</span>
          <router-link
            v-if="i < breadcrumbs.length - 1"
            :to="crumb.path"
            class="hover:text-slate-600"
          >
            {{ crumb.label }}
          </router-link>
          <span v-else class="text-slate-600">{{ crumb.label }}</span>
        </template>
      </nav>
    </div>

    <!-- Right: Quick Actions -->
    <div class="flex items-center gap-3">
      <router-link
        to="/orders/new"
        class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
      >
        <i class="pi pi-plus text-xs" />
        New Order
      </router-link>
    </div>
  </header>
</template>
