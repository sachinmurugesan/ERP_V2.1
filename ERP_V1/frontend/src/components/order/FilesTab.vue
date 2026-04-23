<script setup>
const props = defineProps({
  orderId: { type: String, required: true },
  order: { type: Object, required: true },
  documents: { type: Array, default: () => [] },
})

function formatFileSize(bytes) {
  if (!bytes) return '\u2014'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>
<template>
  <div class="bg-white rounded-xl shadow-sm p-6">
    <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
      <i class="pi pi-paperclip text-blue-500" /> Documents ({{ documents.length }})
    </h3>
    <div v-if="documents.length > 0" class="space-y-2">
      <div v-for="doc in documents" :key="doc.id" class="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg">
        <div class="flex items-center gap-3 min-w-0">
          <i class="pi pi-file text-slate-400 text-sm shrink-0" />
          <div class="min-w-0">
            <p class="text-sm text-slate-700 truncate">{{ doc.filename }}</p>
            <p class="text-xs text-slate-400">{{ doc.doc_type }} · {{ formatFileSize(doc.file_size) }}</p>
          </div>
        </div>
      </div>
    </div>
    <p v-else class="text-sm text-slate-400">No documents uploaded yet</p>
  </div>
</template>
