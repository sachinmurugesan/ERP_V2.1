/**
 * Composable for AI conflict analysis of Excel upload results.
 *
 * Handles building conflict groups from parsed results, sending them to AI,
 * and applying AI suggestions to variant resolutions.
 */
import { ref, computed } from 'vue'
import { excelApi } from '../api'

export function useConflictAnalysis(results, variantResolutions, conflictGroups) {
  const aiResolutions = ref({})
  const analyzingConflicts = ref(false)
  const aiResolutionSource = ref(null)

  const aiStats = computed(() => {
    const entries = Object.values(aiResolutions.value)
    if (entries.length === 0) return null
    const add = entries.filter(e => e.action === 'add_new').length
    const skip = entries.filter(e => e.action === 'duplicate').length
    const replace = entries.filter(e => e.action === 'replace').length
    const highConf = entries.filter(e => e.confidence === 'high').length
    return { add, skip, replace, total: entries.length, highConf }
  })

  async function triggerAiConflictAnalysis() {
    const data = results.value
    if (!data?.result_data) return

    const groups = {}
    // In-file duplicates
    const dupCodes = data.result_summary?.duplicate_codes || []
    dupCodes.forEach(dup => {
      if (!groups[dup.code]) {
        groups[dup.code] = { code: dup.code, rows: [], existing_variants: [] }
      }
      dup.indices.forEach(idx => {
        const row = data.result_data[idx]
        if (row) groups[dup.code].rows.push({ ...row, _idx: idx })
      })
    })
    // DB variant conflicts
    data.result_data.forEach((row, idx) => {
      if (row.match_status === 'NEW_VARIANT' && row.existing_variants?.length > 0) {
        const code = row.manufacturer_code
        if (!groups[code]) {
          groups[code] = { code, rows: [], existing_variants: row.existing_variants }
        } else if (!groups[code].existing_variants.length) {
          groups[code].existing_variants = row.existing_variants
        }
        if (!groups[code].rows.find(r => r._idx === idx)) {
          groups[code].rows.push({ ...row, _idx: idx })
        }
      }
    })

    const groupList = Object.values(groups)
    if (groupList.length === 0) return

    // Trim row data to only fields needed for AI analysis
    const trimmedGroups = groupList.map(g => ({
      code: g.code,
      existing_variants: (g.existing_variants || []).map(ev => ({
        id: ev.id,
        name: ev.product_name || ev.name || '',
        dimension: ev.dimension || '',
      })),
      rows: g.rows.map(r => ({
        _idx: r._idx,
        description: r.description || '',
        chinese_name: r.chinese_name || '',
        dimension: r.dimension || '',
        material: r.material || '',
        manufacturer_code: r.manufacturer_code || '',
      })),
    }))

    analyzingConflicts.value = true
    aiResolutionSource.value = null
    try {
      const { data: aiResult } = await excelApi.analyzeConflicts(trimmedGroups)
      aiResolutionSource.value = aiResult.source || 'heuristic'

      const newAiRes = {}
      const updatedVRes = { ...variantResolutions.value }

      for (const res of (aiResult.resolutions || [])) {
        const key = String(res.row_index)
        newAiRes[key] = {
          action: res.action,
          confidence: res.confidence,
          reason: res.reason,
        }
        if (res.action === 'replace') {
          const group = groupList.find(g => g.rows.some(r => r._idx === res.row_index))
          const replaceId = group?.existing_variants?.[0]?.id || null
          updatedVRes[key] = { action: 'replace', replace_id: replaceId }
        } else {
          updatedVRes[key] = { action: res.action, replace_id: null }
        }
      }

      aiResolutions.value = newAiRes
      variantResolutions.value = updatedVRes
    } catch (_e) {
      aiResolutionSource.value = null
    } finally {
      analyzingConflicts.value = false
    }
  }

  return {
    aiResolutions,
    analyzingConflicts,
    aiResolutionSource,
    aiStats,
    triggerAiConflictAnalysis,
  }
}
