<script setup>
import { useAuth } from '../../composables/useAuth'
const { user } = useAuth()
</script>

<template>
  <div class="p-4 md:p-6 max-w-2xl mx-auto">
    <h1 class="text-xl md:text-2xl font-bold text-slate-800 mb-6">Factory Profile</h1>
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">
      <div class="space-y-4">
        <div>
          <label class="text-xs font-medium text-slate-500 uppercase">Full Name</label>
          <div class="text-lg font-medium text-slate-800 mt-1">{{ user?.full_name || '-' }}</div>
        </div>
        <div>
          <label class="text-xs font-medium text-slate-500 uppercase">Email</label>
          <div class="text-lg text-slate-800 mt-1">{{ user?.email || '-' }}</div>
        </div>
        <div>
          <label class="text-xs font-medium text-slate-500 uppercase">Role</label>
          <div class="mt-1"><span class="px-3 py-1 rounded-full text-sm font-medium bg-violet-100 text-violet-700">{{ user?.role || '-' }}</span></div>
        </div>
        <div>
          <label class="text-xs font-medium text-slate-500 uppercase">Account Type</label>
          <div class="text-sm text-slate-600 mt-1">{{ user?.user_type || '-' }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
