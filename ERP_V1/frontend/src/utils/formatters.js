/**
 * Shared formatting utilities for HarvestERP
 * Extracted from 10+ components to eliminate duplication.
 */

/**
 * Format an ISO date string for Indian locale display.
 * @param {string|null} isoStr - ISO date string
 * @returns {string} Formatted date or em-dash
 */
export function formatDate(isoStr) {
  if (!isoStr) return '\u2014'
  return new Date(isoStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format a currency amount with the correct symbol.
 * @param {number|null} amount
 * @param {string} currency - 'INR', 'CNY', 'USD'
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currency = 'INR') {
  if (amount == null) return '\u2014'
  const num = Number(amount)
  const opts = { minimumFractionDigits: 2, maximumFractionDigits: 2 }

  switch (currency) {
    case 'INR':
      return '\u20B9' + num.toLocaleString('en-IN', opts)
    case 'CNY':
      return '\u00A5' + num.toLocaleString(undefined, opts)
    case 'USD':
      return '$' + num.toLocaleString(undefined, opts)
    default:
      return currency + ' ' + num.toLocaleString(undefined, opts)
  }
}

/**
 * Format INR amount (shorthand for formatCurrency(amount, 'INR'))
 * @param {number|null} val
 * @returns {string}
 */
export function formatINR(val) {
  return formatCurrency(val, 'INR')
}

/**
 * Format a number with locale separators.
 * @param {number|null} val
 * @param {number} decimals
 * @returns {string}
 */
export function formatNumber(val, decimals = 0) {
  if (val == null) return '\u2014'
  return Number(val).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
