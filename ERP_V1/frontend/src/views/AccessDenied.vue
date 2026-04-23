<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <div class="flex items-center justify-center min-h-[60vh]">
    <div class="text-center max-w-md">
      <div class="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
        <svg class="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
        </svg>
      </div>
      <h1 class="text-2xl font-bold text-slate-800 mb-2">Access Denied</h1>
      <p class="text-slate-500 mb-6">You don't have permission to view this page. Contact your administrator to request access.</p>
      <div class="flex gap-3 justify-center">
        <button
          @click="router.push('/')"
          class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          Go to Dashboard
        </button>
        <button
          @click="router.back()"
          class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
        >
          Go Back
        </button>
      </div>
    </div>
  </div>
</template>
