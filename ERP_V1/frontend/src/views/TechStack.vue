<script setup>
import { ref } from 'vue'
import axios from 'axios'

const activeCategory = ref('overview')
const graphRebuilding = ref(false)
const graphLastBuilt = ref(null)

async function rebuildGraph() {
  graphRebuilding.value = true
  try {
    // Trigger AST rebuild via backend
    const { data } = await axios.post('/api/graphify/rebuild/')
    graphLastBuilt.value = new Date().toLocaleString()
    // Reload iframe
    const iframe = document.getElementById('graphify-iframe')
    if (iframe) iframe.src = iframe.src
  } catch (e) {
    console.error('Graph rebuild failed:', e)
  }
  graphRebuilding.value = false
}

const stats = {
  totalLines: 49322,
  frontendLines: 29470,
  backendLines: 19852,
  tables: 46,
  apiEndpoints: 215,
  orderStages: 17,
  vueComponents: 60,
  services: 7,
  apiMethods: 201,
  tests: 55,
  schemas: 7,
  schemaModels: 54,
}

const categories = [
  { id: 'overview', label: 'Overview' },
  { id: 'security', label: 'Security' },
  { id: 'frontend', label: 'Frontend' },
  { id: 'backend', label: 'Backend' },
  { id: 'database', label: 'Database' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'ai', label: 'AI Integration' },
]

const frontendStack = [
  { name: 'Vue 3', version: '3.5.25', purpose: 'Composition API framework with <script setup>', detail: 'Reactive state, 60 components, composables' },
  { name: 'Vite', version: '7.3.1', purpose: 'Build tool with HMR & API proxy', detail: 'Sub-second hot reload, Tailwind plugin' },
  { name: 'PrimeVue', version: '4.5.4', purpose: 'Enterprise UI component library', detail: 'DataTable, Dialog, Toast — 80+ components' },
  { name: 'Tailwind CSS', version: '4.2.0', purpose: 'Utility-first CSS with JIT', detail: 'Custom tokens, responsive utilities' },
  { name: 'Pinia', version: '3.0.4', purpose: 'State management', detail: 'useAuth, useNotifications composables' },
  { name: 'Vue Router', version: '4.6.4', purpose: 'Client-side routing', detail: '20+ routes, lazy loading, nested tabs' },
  { name: 'Axios', version: '1.13.5', purpose: '201 API methods across 16 modules', detail: 'Interceptors, auto-auth, error handling' },
  { name: 'SheetJS', version: '0.18.5', purpose: 'Client-side Excel preview', detail: 'Parse before upload, validation' },
]

const backendStack = [
  { name: 'FastAPI', version: '0.115.6', purpose: '17 routers, 215 endpoints', detail: 'Dependency injection, OpenAPI docs' },
  { name: 'Uvicorn', version: '0.34.0', purpose: 'ASGI server', detail: 'Hot reload in dev, async workers' },
  { name: 'SQLAlchemy', version: '2.0.36', purpose: 'ORM with 46 table models', detail: 'Relationships, query builder' },
  { name: 'Pydantic', version: '2.10.4', purpose: '54 models across 7 schema files', detail: 'Validation + serialization' },
  { name: 'Alembic', version: '1.14+', purpose: 'Database migrations', detail: '2 revisions, PostgreSQL-ready' },
  { name: 'openpyxl', version: '3.1.5', purpose: 'Factory Excel parsing', detail: 'Drawing extraction, cell reading' },
  { name: 'Pillow', version: '11.1.0', purpose: 'Image processing', detail: 'Resize, thumbnails, format conversion' },
  { name: 'slowapi', version: '0.1.9', purpose: 'Rate limiting', detail: 'Login 5/min, uploads 3/min per IP' },
  { name: 'Anthropic SDK', version: '0.40+', purpose: 'Claude AI tool use', detail: 'Conflict resolution, column mapping' },
]

const orderStages = [
  { stage: 'CLIENT_DRAFT', label: 'Client Draft', desc: 'Client inquiry submitted' },
  { stage: 'DRAFT', label: 'Draft', desc: 'Create & add items' },
  { stage: 'PENDING_PI', label: 'Pending PI', desc: 'Load factory data' },
  { stage: 'PI_SENT', label: 'PI Sent', desc: 'Proforma sent' },
  { stage: 'ADVANCE_PENDING', label: 'Adv Pending', desc: 'Awaiting advance' },
  { stage: 'ADVANCE_RECEIVED', label: 'Adv Received', desc: 'Advance paid' },
  { stage: 'FACTORY_ORDERED', label: 'Factory Ord', desc: 'Order placed' },
  { stage: 'PRODUCTION_60', label: 'Prod 60%', desc: 'In progress' },
  { stage: 'PRODUCTION_80', label: 'Prod 80%', desc: 'Nearing done' },
  { stage: 'PRODUCTION_90', label: 'Prod 90%', desc: 'Final stages' },
  { stage: 'PLAN_PACKING', label: 'Plan Packing', desc: 'Packing prep' },
  { stage: 'FINAL_PI', label: 'Final PI', desc: 'Recalculate' },
  { stage: 'PRODUCTION_100', label: 'Prod 100%', desc: 'Ready to ship' },
  { stage: 'BOOKED', label: 'Booked', desc: 'Container reserved' },
  { stage: 'LOADED', label: 'Loaded', desc: 'In container' },
  { stage: 'SAILED', label: 'Sailed', desc: 'At sea' },
  { stage: 'ARRIVED', label: 'Arrived', desc: 'At port' },
  { stage: 'CUSTOMS_FILED', label: 'Customs', desc: 'Filed' },
  { stage: 'CLEARED', label: 'Cleared', desc: 'Cleared' },
  { stage: 'DELIVERED', label: 'Delivered', desc: 'Verified' },
  { stage: 'AFTER_SALES', label: 'After-Sales', desc: 'Claims' },
  { stage: 'COMPLETED', label: 'Completed', desc: 'Closed' },
]

const dbTableGroups = [
  { group: 'Master Data', tables: ['clients', 'factories', 'factory_contacts', 'categories', 'users'] },
  { group: 'Products', tables: ['products', 'product_images', 'product_verifications', 'client_product_barcodes', 'client_category_access', 'client_brand_access'] },
  { group: 'Orders', tables: ['orders', 'order_items', 'stage_overrides', 'proforma_invoices', 'pi_revisions', 'product_requests', 'client_product_access', 'audit_log'] },
  { group: 'Financial', tables: ['payments', 'factory_payments', 'payment_audit_log', 'client_credits', 'factory_credits', 'exchange_rates', 'hsn_tariffs'] },
  { group: 'Logistics', tables: ['packing_lists', 'packing_list_items', 'shipments', 'shipment_items', 'shipping_documents', 'service_providers', 'customs_milestones', 'customs_documents', 'clearance_charges'] },
  { group: 'Operations', tables: ['aftersales_items', 'bills_of_entry', 'boe_line_items', 'unloaded_items', 'notifications', 'documents', 'processing_jobs', 'warehouse_stock'] },
  { group: 'System', tables: ['system_settings', 'transit_times', 'alembic_version'] },
]

const securityFixes = [
  { id: 1, title: 'Auth Bypass Removed', desc: 'Dev fallback gated behind DEBUG + ALLOW_DEV_AUTH dual flags', severity: 'CRITICAL' },
  { id: 2, title: 'JWT Secret Validated at Startup', desc: 'Server refuses to start with insecure default key', severity: 'CRITICAL' },
  { id: 3, title: 'Admin Seed Secured', desc: 'Random password via secrets.token_urlsafe, gitignored credentials file', severity: 'CRITICAL' },
  { id: 4, title: 'Users Router Auth Enforced', desc: 'require_admin dependency on all user management endpoints', severity: 'CRITICAL' },
  { id: 5, title: 'Login Rate Limited', desc: '5 requests/minute per IP via slowapi — JSON 429 response', severity: 'HIGH' },
  { id: 6, title: 'Audit Trail Real Identity', desc: 'All hardcoded dev-admin entries replaced with real current_user', severity: 'HIGH' },
]

const securityLayers = [
  { label: 'Edge & Gateway', items: ['SlowAPI Rate Limiter (5/min login, 100/min reads)', '200MB Payload Firewall', 'Security Headers (nosniff, DENY, strict-origin)', 'CORS Origin Whitelist'] },
  { label: 'Identity & Access', items: ['Argon2id Password Hashing (OWASP baseline)', 'JWT Access (15min) + Refresh (7d) tokens', 'RBAC — 5 roles enforced on every endpoint', 'Row-Level Security per client/factory', 'Field-Level Stripping per role', 'Vue Router Guards + 401 auto-logout'] },
  { label: 'Application & Memory', items: ['1MB Chunked File Streaming (all uploads)', 'Pydantic JSON Bomb Prevention (max 500 items)', 'Filename Sanitization (UUID prefix)', 'Custom Exception Handlers (4 registered)'] },
  { label: 'Data & Database', items: ['Pagination Enforcement (max 200 per page)', 'Parameterized Queries (SQLAlchemy ORM)', 'Immutable Audit Trail (PaymentAuditLog)', 'Soft Delete + Bin (recoverable products)'] },
]

const archLayers = [
  { label: 'Presentation', tech: 'Vue 3 + PrimeVue + Tailwind', detail: '60 components, reactive templates' },
  { label: 'State', tech: 'Pinia + Composables', detail: 'useAuth, useNotifications, useApiError' },
  { label: 'API Client', tech: 'Axios', detail: '201 methods, 16 modules, interceptors' },
  { label: 'Schemas', tech: 'Pydantic v2', detail: '7 files, 54 models' },
  { label: 'Routers', tech: 'FastAPI', detail: '17 routers, 215 endpoints' },
  { label: 'Services', tech: 'Business Logic + AI', detail: '7 service files' },
  { label: 'ORM', tech: 'SQLAlchemy 2.0', detail: '46 models, relationships' },
  { label: 'Database', tech: 'SQLite / PostgreSQL 16', detail: 'Alembic managed, dual-mode' },
]

const expandedSec = ref(null)
function toggleSec(i) { expandedSec.value = expandedSec.value === i ? null : i }
</script>

<template>
  <div class="min-h-screen" style="background: #f6fafe; font-family: 'Inter', system-ui, -apple-system, sans-serif;">

    <!-- ─── Hero / Header ──────────────────────── -->
    <div style="background: linear-gradient(135deg, #f0f4f8 0%, #f6fafe 100%);">
      <div class="max-w-6xl mx-auto px-8 pt-12 pb-10">
        <div class="mb-10">
          <p class="uppercase tracking-[0.2em] text-xs font-medium mb-3" style="color: #10b981; font-family: 'JetBrains Mono', monospace;">Supply Chain Management System</p>
          <h1 class="font-bold tracking-tight" style="font-size: 3.5rem; line-height: 1; letter-spacing: -0.02em; color: #171c1f;">HarvestERP</h1>
          <p class="mt-3 text-lg" style="color: #6c7a71;">Interactive architecture overview — precision-built for import operations.</p>
        </div>

        <!-- KPI Strip — Display-LG numbers -->
        <div class="grid grid-cols-3 md:grid-cols-6 gap-8">
          <div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 700; color: #171c1f; letter-spacing: -0.02em;">{{ stats.totalLines.toLocaleString() }}</div>
            <div class="uppercase tracking-[0.15em] mt-1" style="font-size: 0.6875rem; color: #6c7a71; font-family: 'JetBrains Mono', monospace;">Lines of Code</div>
          </div>
          <div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 700; color: #171c1f;">{{ stats.tables }}</div>
            <div class="uppercase tracking-[0.15em] mt-1" style="font-size: 0.6875rem; color: #6c7a71; font-family: 'JetBrains Mono', monospace;">DB Tables</div>
          </div>
          <div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 700; color: #171c1f;">{{ stats.apiEndpoints }}</div>
            <div class="uppercase tracking-[0.15em] mt-1" style="font-size: 0.6875rem; color: #6c7a71; font-family: 'JetBrains Mono', monospace;">Endpoints</div>
          </div>
          <div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 700; color: #171c1f;">{{ stats.orderStages }}</div>
            <div class="uppercase tracking-[0.15em] mt-1" style="font-size: 0.6875rem; color: #6c7a71; font-family: 'JetBrains Mono', monospace;">Order Stages</div>
          </div>
          <div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 700; color: #171c1f;">{{ stats.vueComponents }}</div>
            <div class="uppercase tracking-[0.15em] mt-1" style="font-size: 0.6875rem; color: #6c7a71; font-family: 'JetBrains Mono', monospace;">Components</div>
          </div>
          <div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 700; color: #171c1f;">{{ stats.services }}</div>
            <div class="uppercase tracking-[0.15em] mt-1" style="font-size: 0.6875rem; color: #6c7a71; font-family: 'JetBrains Mono', monospace;">Services</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Knowledge Graph ─────────────────────── -->
    <div class="max-w-6xl mx-auto px-8 pb-8">
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="px-6 py-4 flex items-center justify-between border-b border-slate-100">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <i class="pi pi-share-alt text-white text-lg" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-800">Codebase Knowledge Graph</h3>
              <p class="text-[11px] text-slate-500">1,433 nodes · 10,485 edges · 37 communities — powered by graphify</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <a href="/graphify/graph.html" target="_blank"
              class="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1.5">
              <i class="pi pi-external-link text-[10px]" /> Full Screen
            </a>
            <a href="/graphify/GRAPH_REPORT.md" target="_blank"
              class="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1.5">
              <i class="pi pi-file text-[10px]" /> Report
            </a>
          </div>
        </div>
        <iframe id="graphify-iframe" src="/graphify/graph.html" class="w-full border-0" style="height: 500px;" />
      </div>
    </div>

    <!-- ─── Navigation ─────────────────────────── -->
    <div class="sticky top-0 z-20" style="background: rgba(246, 250, 254, 0.92); backdrop-filter: blur(20px);">
      <div class="max-w-6xl mx-auto px-8">
        <div class="flex gap-1 overflow-x-auto py-3">
          <button
            v-for="cat in categories" :key="cat.id"
            @click="activeCategory = cat.id"
            class="px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200"
            :style="activeCategory === cat.id
              ? 'background: linear-gradient(135deg, #006c49, #10b981); color: white;'
              : 'color: #6c7a71;'"
            @mouseenter="$event.target.style.background = activeCategory !== cat.id ? '#e4e9ed' : $event.target.style.background"
            @mouseleave="$event.target.style.background = activeCategory !== cat.id ? 'transparent' : $event.target.style.background"
          >{{ cat.label }}</button>
        </div>
      </div>
    </div>

    <div class="max-w-6xl mx-auto px-8 py-10">

      <!-- ═══ OVERVIEW ═══════════════════════════ -->
      <div v-if="activeCategory === 'overview'" class="space-y-10">

        <!-- Codebase Distribution -->
        <div>
          <h2 class="font-semibold text-2xl mb-6" style="color: #171c1f;">Codebase Distribution</h2>
          <div class="flex h-3 rounded-full overflow-hidden mb-6" style="background: #e4e9ed;">
            <div class="h-full rounded-l-full transition-all duration-700" style="width: 60%; background: linear-gradient(135deg, #6366f1, #818cf8);"></div>
            <div class="h-full rounded-r-full transition-all duration-700" style="width: 40%; background: linear-gradient(135deg, #10b981, #34d399);"></div>
          </div>
          <div class="grid grid-cols-2 gap-6">
            <div class="rounded-2xl p-6" style="background: #ffffff;">
              <div style="font-family: 'JetBrains Mono', monospace; font-size: 2.5rem; font-weight: 700; color: #6366f1; letter-spacing: -0.02em;">{{ stats.frontendLines.toLocaleString() }}</div>
              <div class="mt-1" style="color: #6c7a71; font-size: 0.875rem;">Frontend — Vue, JavaScript, CSS</div>
              <div class="mt-1 uppercase tracking-[0.15em]" style="font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #a0aab0;">60% of codebase</div>
            </div>
            <div class="rounded-2xl p-6" style="background: #ffffff;">
              <div style="font-family: 'JetBrains Mono', monospace; font-size: 2.5rem; font-weight: 700; color: #10b981; letter-spacing: -0.02em;">{{ stats.backendLines.toLocaleString() }}</div>
              <div class="mt-1" style="color: #6c7a71; font-size: 0.875rem;">Backend — Python</div>
              <div class="mt-1 uppercase tracking-[0.15em]" style="font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #a0aab0;">40% of codebase</div>
            </div>
          </div>
        </div>

        <!-- Order Workflow -->
        <div>
          <h2 class="font-semibold text-2xl mb-2" style="color: #171c1f;">22-Status Order Workflow</h2>
          <p class="mb-6" style="color: #6c7a71; font-size: 0.875rem;">17 logical stages, 22 internal statuses. All transitions are manual with gate validations.</p>
          <div class="flex flex-wrap gap-2 items-center">
            <template v-for="(s, i) in orderStages" :key="s.stage">
              <div
                class="px-3 py-1.5 rounded-lg cursor-default transition-all duration-200 hover:scale-105"
                style="background: #ffffff; font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #171c1f; letter-spacing: 0.02em;"
                :title="s.desc"
              >{{ s.label }}</div>
              <svg v-if="i < orderStages.length - 1" class="w-3 h-3 flex-shrink-0" style="color: #c5ccd0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </template>
          </div>
        </div>

        <!-- Quick Metrics -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div class="rounded-2xl p-5" style="background: #ffffff;">
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 700; color: #171c1f;">{{ stats.apiMethods }}</div>
            <div class="uppercase tracking-[0.15em] mt-1" style="font-size: 0.6875rem; color: #6c7a71; font-family: 'JetBrains Mono', monospace;">API Methods</div>
          </div>
          <div class="rounded-2xl p-5" style="background: #ffffff;">
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 700; color: #171c1f;">{{ stats.schemaModels }}</div>
            <div class="uppercase tracking-[0.15em] mt-1" style="font-size: 0.6875rem; color: #6c7a71; font-family: 'JetBrains Mono', monospace;">Pydantic Models</div>
          </div>
          <div class="rounded-2xl p-5" style="background: #ffffff;">
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 700; color: #171c1f;">{{ stats.tests }}</div>
            <div class="uppercase tracking-[0.15em] mt-1" style="font-size: 0.6875rem; color: #6c7a71; font-family: 'JetBrains Mono', monospace;">Automated Tests</div>
          </div>
          <div class="rounded-2xl p-5" style="background: #ffffff;">
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 700; color: #171c1f;">{{ stats.schemas }}</div>
            <div class="uppercase tracking-[0.15em] mt-1" style="font-size: 0.6875rem; color: #6c7a71; font-family: 'JetBrains Mono', monospace;">Schema Files</div>
          </div>
        </div>
      </div>

      <!-- ═══ SECURITY ═══════════════════════════ -->
      <div v-if="activeCategory === 'security'" class="space-y-10">

        <!-- Posture Header -->
        <div class="flex items-end justify-between">
          <div>
            <h2 class="font-semibold text-2xl" style="color: #171c1f;">Security Posture</h2>
            <p style="color: #6c7a71; font-size: 0.875rem;">6 critical/high vulnerabilities fixed — 55 automated tests passing</p>
          </div>
          <div class="flex items-center gap-3">
            <!-- Data Pulse — live indicator -->
            <div class="flex items-center gap-2 px-4 py-2 rounded-full" style="background: rgba(16, 185, 129, 0.08);">
              <div class="w-2 h-2 rounded-full animate-pulse" style="background: #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);"></div>
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #10b981; font-weight: 600; letter-spacing: 0.05em;">95% ENFORCED</span>
            </div>
          </div>
        </div>

        <!-- Fix List -->
        <div class="space-y-3">
          <div v-for="fix in securityFixes" :key="fix.id" class="flex items-start gap-4 p-5 rounded-2xl transition-all duration-200" style="background: #ffffff;">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style="background: rgba(16, 185, 129, 0.1);">
              <svg class="w-4 h-4" style="color: #10b981;" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3">
                <span class="font-semibold" style="color: #171c1f; font-size: 0.875rem;">Fix {{ fix.id }}: {{ fix.title }}</span>
                <span
                  class="px-2 py-0.5 rounded-full uppercase tracking-[0.1em]"
                  :style="fix.severity === 'CRITICAL'
                    ? 'background: rgba(239, 68, 68, 0.08); color: #dc2626; font-size: 0.6875rem; font-family: JetBrains Mono, monospace; font-weight: 600;'
                    : 'background: rgba(245, 158, 11, 0.08); color: #d97706; font-size: 0.6875rem; font-family: JetBrains Mono, monospace; font-weight: 600;'"
                >{{ fix.severity }}</span>
              </div>
              <p class="mt-1" style="color: #6c7a71; font-size: 0.8125rem;">{{ fix.desc }}</p>
            </div>
          </div>
        </div>

        <!-- Defense Layers -->
        <div>
          <h3 class="font-semibold text-lg mb-4" style="color: #171c1f;">Defense-in-Depth Layers</h3>
          <div class="space-y-2">
            <div v-for="(layer, i) in securityLayers" :key="i" @click="toggleSec(i)" class="rounded-2xl cursor-pointer transition-all duration-300" :style="expandedSec === i ? 'background: #ffffff;' : 'background: #ffffff;'">
              <div class="flex items-center justify-between p-5">
                <div class="flex items-center gap-4">
                  <div class="w-9 h-9 rounded-lg flex items-center justify-center" style="background: rgba(99, 102, 241, 0.08); font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; font-weight: 700; color: #6366f1;">{{ i + 1 }}</div>
                  <div>
                    <div class="font-semibold" style="color: #171c1f; font-size: 0.9375rem;">{{ layer.label }}</div>
                    <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #a0aab0;">{{ layer.items.length }} controls</div>
                  </div>
                </div>
                <svg class="w-4 h-4 transition-transform duration-300" :class="{ 'rotate-180': expandedSec === i }" style="color: #c5ccd0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              </div>
              <div v-if="expandedSec === i" class="px-5 pb-5 pt-0">
                <div class="pt-4 space-y-3" style="border-top: 1px solid rgba(108, 122, 113, 0.1);">
                  <div v-for="item in layer.items" :key="item" class="flex items-start gap-3">
                    <svg class="w-4 h-4 mt-0.5 flex-shrink-0" style="color: #10b981;" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                    <span style="font-size: 0.8125rem; color: #4a5568;">{{ item }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Test Summary -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div class="rounded-2xl p-5" style="background: #ffffff;">
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 700; color: #10b981;">55</div>
            <div class="uppercase tracking-[0.15em] mt-1" style="font-size: 0.6875rem; color: #6c7a71; font-family: 'JetBrains Mono', monospace;">Tests Passing</div>
          </div>
          <div class="rounded-2xl p-5" style="background: #ffffff;">
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 700; color: #6366f1;">5</div>
            <div class="uppercase tracking-[0.15em] mt-1" style="font-size: 0.6875rem; color: #6c7a71; font-family: 'JetBrains Mono', monospace;">RBAC Roles</div>
          </div>
          <div class="rounded-2xl p-5" style="background: #ffffff;">
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 700; color: #6366f1;">3</div>
            <div class="uppercase tracking-[0.15em] mt-1" style="font-size: 0.6875rem; color: #6c7a71; font-family: 'JetBrains Mono', monospace;">Isolated Portals</div>
          </div>
          <div class="rounded-2xl p-5" style="background: #ffffff;">
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 700; color: #10b981;">0</div>
            <div class="uppercase tracking-[0.15em] mt-1" style="font-size: 0.6875rem; color: #6c7a71; font-family: 'JetBrains Mono', monospace;">Data Leaks</div>
          </div>
        </div>
      </div>

      <!-- ═══ FRONTEND ═══════════════════════════ -->
      <div v-if="activeCategory === 'frontend'" class="space-y-10">
        <h2 class="font-semibold text-2xl" style="color: #171c1f;">Frontend Stack</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div v-for="tech in frontendStack" :key="tech.name" class="rounded-2xl p-5 transition-all duration-200 hover:translate-y-[-2px]" style="background: #ffffff;">
            <div class="flex items-center justify-between mb-3">
              <span class="font-semibold" style="color: #171c1f;">{{ tech.name }}</span>
              <span class="px-2 py-0.5 rounded-full" style="font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; background: #f0f4f8; color: #6c7a71;">{{ tech.version }}</span>
            </div>
            <p style="font-size: 0.875rem; color: #4a5568;">{{ tech.purpose }}</p>
            <p class="mt-1" style="font-size: 0.8125rem; color: #a0aab0;">{{ tech.detail }}</p>
          </div>
        </div>

        <!-- Utilities -->
        <div>
          <h3 class="font-semibold text-lg mb-4" style="color: #171c1f;">Utilities & Composables</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="u in [
              { name: 'useApiError', desc: 'Centralized API error handling' },
              { name: 'useAuth', desc: 'Session state, JWT interceptors, role checks' },
              { name: 'formatters.js', desc: 'Currency (INR/CNY), date, number formatting' },
              { name: 'constants.js', desc: 'Shared stage colors, status maps' },
            ]" :key="u.name" class="flex items-center gap-4 p-4 rounded-2xl" style="background: #ffffff;">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style="background: rgba(99, 102, 241, 0.06);">
                <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; font-weight: 700; color: #6366f1;">fn</span>
              </div>
              <div>
                <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.8125rem; font-weight: 600; color: #171c1f;">{{ u.name }}</div>
                <div style="font-size: 0.8125rem; color: #6c7a71;">{{ u.desc }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ BACKEND ════════════════════════════ -->
      <div v-if="activeCategory === 'backend'" class="space-y-10">
        <h2 class="font-semibold text-2xl" style="color: #171c1f;">Backend Stack</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div v-for="tech in backendStack" :key="tech.name" class="rounded-2xl p-5 transition-all duration-200 hover:translate-y-[-2px]" style="background: #ffffff;">
            <div class="flex items-center justify-between mb-3">
              <span class="font-semibold" style="color: #171c1f;">{{ tech.name }}</span>
              <span class="px-2 py-0.5 rounded-full" style="font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; background: #f0f4f8; color: #6c7a71;">{{ tech.version }}</span>
            </div>
            <p style="font-size: 0.875rem; color: #4a5568;">{{ tech.purpose }}</p>
            <p class="mt-1" style="font-size: 0.8125rem; color: #a0aab0;">{{ tech.detail }}</p>
          </div>
        </div>

        <!-- Schema + Exceptions -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 class="font-semibold text-lg mb-4" style="color: #171c1f;">Schema Layer</h3>
            <div class="space-y-2">
              <div v-for="s in ['auth', 'orders', 'products', 'clients', 'factories', 'finance', 'common']" :key="s" class="px-4 py-3 rounded-xl" style="background: #ffffff;">
                <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.8125rem; color: #6366f1;">schemas/{{ s }}.py</span>
              </div>
            </div>
          </div>
          <div>
            <h3 class="font-semibold text-lg mb-4" style="color: #171c1f;">Exception Hierarchy</h3>
            <div class="space-y-2">
              <div v-for="e in [
                { name: 'EntityNotFoundError', code: '404' },
                { name: 'AccessDeniedError', code: '403' },
                { name: 'DuplicateEntityError', code: '409' },
                { name: 'InvalidStageTransitionError', code: '400' },
                { name: 'FileTooLargeError', code: '413' },
                { name: 'ValidationError', code: '400' },
              ]" :key="e.name" class="flex items-center justify-between px-4 py-3 rounded-xl" style="background: #ffffff;">
                <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.8125rem; color: #171c1f;">{{ e.name }}</span>
                <span class="px-2 py-0.5 rounded-full" style="font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; background: rgba(99, 102, 241, 0.06); color: #6366f1;">{{ e.code }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ DATABASE ═══════════════════════════ -->
      <div v-if="activeCategory === 'database'" class="space-y-10">
        <div class="flex items-end justify-between">
          <div>
            <h2 class="font-semibold text-2xl" style="color: #171c1f;">Database</h2>
            <p style="color: #6c7a71; font-size: 0.875rem;">SQLite (dev) / PostgreSQL 16 (prod) — Alembic managed</p>
          </div>
          <div class="flex items-center gap-2 px-4 py-2 rounded-full" style="background: rgba(99, 102, 241, 0.06);">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #6366f1; font-weight: 600;">46 TABLES</span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="group in dbTableGroups" :key="group.group" class="rounded-2xl p-5" style="background: #ffffff;">
            <div class="flex items-center justify-between mb-4">
              <span class="font-semibold" style="color: #171c1f; font-size: 0.9375rem;">{{ group.group }}</span>
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #a0aab0;">{{ group.tables.length }}</span>
            </div>
            <div class="space-y-1.5">
              <div v-for="table in group.tables" :key="table" class="px-3 py-1.5 rounded-lg" style="background: #f0f4f8;">
                <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #4a5568;">{{ table }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Migration History -->
        <div>
          <h3 class="font-semibold text-lg mb-4" style="color: #171c1f;">Alembic Migration History</h3>
          <div class="space-y-3">
            <div class="flex items-start gap-4 p-5 rounded-2xl" style="background: #ffffff;">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background: rgba(99, 102, 241, 0.08); font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; font-weight: 700; color: #6366f1;">1</div>
              <div>
                <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.8125rem; color: #171c1f; font-weight: 600;">39d330b9efa7</div>
                <div style="font-size: 0.8125rem; color: #6c7a71;">baseline_schema — stamps existing database state</div>
              </div>
            </div>
            <div class="flex items-start gap-4 p-5 rounded-2xl" style="background: #ffffff;">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background: rgba(16, 185, 129, 0.08); font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; font-weight: 700; color: #10b981;">2</div>
              <div>
                <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.8125rem; color: #171c1f; font-weight: 600;">fb606be1a020</div>
                <div style="font-size: 0.8125rem; color: #6c7a71;">drop_dead_tables_fix_is_split — remove dead models, enforce NOT NULL</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ ARCHITECTURE ═══════════════════════ -->
      <div v-if="activeCategory === 'architecture'" class="space-y-10">
        <h2 class="font-semibold text-2xl" style="color: #171c1f;">8-Layer Architecture</h2>

        <div class="space-y-1">
          <template v-for="(layer, i) in archLayers" :key="layer.label">
            <div class="flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 hover:translate-x-1" style="background: #ffffff;">
              <div class="w-9 h-9 rounded-lg text-white flex items-center justify-center text-xs font-bold flex-shrink-0" :class="layer.color">{{ i + 1 }}</div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold" style="color: #171c1f; font-size: 0.9375rem;">{{ layer.label }}</div>
                <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #6366f1;">{{ layer.tech }}</div>
              </div>
              <div class="hidden sm:block text-right" style="font-size: 0.8125rem; color: #a0aab0; max-width: 16rem;">{{ layer.detail }}</div>
            </div>
            <div v-if="i < archLayers.length - 1" class="flex justify-center py-0.5">
              <svg class="w-4 h-4" style="color: #c5ccd0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
            </div>
          </template>
        </div>

        <!-- Patterns -->
        <div>
          <h3 class="font-semibold text-lg mb-4" style="color: #171c1f;">Design Patterns</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div v-for="p in [
              { title: 'Snapshot Pattern', desc: 'OrderItem captures product attributes at transition. Protects against downstream edits.' },
              { title: 'Schema-First API', desc: '54 Pydantic models define the contract. Centralized validation + OpenAPI generation.' },
              { title: 'Service Layer', desc: 'Business logic extracted from routers into 7 service files. HTTP-free domain logic.' },
              { title: 'Variant System', desc: 'Parent/child product hierarchy. Parent is code shell, children are real variants.' },
              { title: 'Exception Hierarchy', desc: '7 domain exceptions with 4 HTTP handlers. Services raise, routers convert.' },
              { title: 'Soft Delete + Bin', desc: 'Products use deleted_at. Referenced items blocked from hard delete. Recoverable.' },
            ]" :key="p.title" class="rounded-2xl p-5" style="background: #ffffff;">
              <h4 class="font-semibold mb-2" style="color: #171c1f; font-size: 0.875rem;">{{ p.title }}</h4>
              <p style="font-size: 0.8125rem; color: #6c7a71; line-height: 1.6;">{{ p.desc }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ AI INTEGRATION ═════════════════════ -->
      <div v-if="activeCategory === 'ai'" class="space-y-10">
        <div>
          <p class="uppercase tracking-[0.2em] text-xs font-medium mb-2" style="color: #6366f1; font-family: 'JetBrains Mono', monospace;">Anthropic Integration</p>
          <h2 class="font-semibold text-2xl mb-1" style="color: #171c1f;">Claude AI — Structured Tool Use</h2>
          <p style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #a0aab0;">model: claude-haiku-4-5-20251001</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="rounded-2xl p-6" style="background: #ffffff;">
            <h3 class="font-semibold mb-3" style="color: #171c1f;">Conflict Resolution</h3>
            <p class="mb-4" style="font-size: 0.8125rem; color: #6c7a71; line-height: 1.6;">When Excel import has duplicate part codes with different attributes, AI analyzes whether each row is a genuine new variant or a duplicate to skip.</p>
            <div class="space-y-1">
              <div class="px-3 py-2 rounded-lg" style="background: #f0f4f8; font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #6366f1;">services/conflict_resolver.py</div>
              <div class="px-3 py-2 rounded-lg" style="background: #f0f4f8; font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #6366f1;">services/ai_client.py</div>
            </div>
          </div>
          <div class="rounded-2xl p-6" style="background: #ffffff;">
            <h3 class="font-semibold mb-3" style="color: #171c1f;">Column Mapping</h3>
            <p class="mb-4" style="font-size: 0.8125rem; color: #6c7a71; line-height: 1.6;">Auto-detects which Excel columns map to which data fields using AI analysis of header text — code, description, quantity, price.</p>
            <div class="space-y-1">
              <div class="px-3 py-2 rounded-lg" style="background: #f0f4f8; font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #6366f1;">services/column_mapper.py</div>
            </div>
          </div>
        </div>

        <!-- AI Flow -->
        <div class="rounded-2xl p-6" style="background: #ffffff;">
          <h3 class="font-semibold mb-5" style="color: #171c1f;">Decision Flow</h3>
          <div class="flex items-center gap-3 flex-wrap">
            <span v-for="(step, i) in ['Excel Upload', 'Detect Conflicts', 'Send to Claude', 'Tool Use Response', 'Auto-Select', 'User Confirms']" :key="step" class="flex items-center gap-3">
              <span class="px-3 py-1.5 rounded-lg" style="background: #f0f4f8; font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #171c1f;">{{ step }}</span>
              <svg v-if="i < 5" class="w-3 h-3 flex-shrink-0" style="color: #c5ccd0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </span>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
