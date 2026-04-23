/**
 * Shared factory portal utilities — single source of truth for
 * status colors visible to factory users.
 * Factory only sees post-FACTORY_ORDERED stages.
 */

export const FACTORY_STATUS_COLORS = {
  FACTORY_ORDERED: 'bg-violet-100 text-violet-700',
  PRODUCTION_60: 'bg-orange-100 text-orange-700',
  PRODUCTION_80: 'bg-orange-100 text-orange-700',
  PRODUCTION_90: 'bg-orange-100 text-orange-700',
  PRODUCTION_100: 'bg-green-100 text-green-700',
  BOOKED: 'bg-cyan-100 text-cyan-700',
  LOADED: 'bg-blue-100 text-blue-700',
  SAILED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
}
