import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { title: 'Dashboard', icon: 'pi-home' }
  },

  // === Orders ===
  {
    path: '/orders',
    name: 'OrderList',
    component: () => import('../views/orders/OrderList.vue'),
    meta: { title: 'Orders', icon: 'pi-shopping-cart' }
  },
  {
    path: '/orders/new',
    name: 'OrderDraft',
    component: () => import('../views/orders/OrderDraft.vue'),
    meta: { title: 'New Order', parent: 'OrderList' }
  },
  {
    path: '/orders/:id',
    name: 'OrderDetail',
    component: () => import('../views/orders/OrderDetail.vue'),
    meta: { title: 'Order Detail', parent: 'OrderList' },
    props: true
  },
  {
    path: '/orders/:id/upload-excel',
    name: 'ExcelUpload',
    component: () => import('../views/orders/ExcelUpload.vue'),
    meta: { title: 'Upload Excel', parent: 'OrderDetail' },
    props: true
  },

  // === Master Data ===
  {
    path: '/products',
    name: 'ProductList',
    component: () => import('../views/products/ProductList.vue'),
    meta: { title: 'Products', icon: 'pi-box' }
  },
  {
    path: '/products/new',
    name: 'ProductNew',
    component: () => import('../views/products/ProductForm.vue'),
    meta: { title: 'New Product', parent: 'ProductList' }
  },
  {
    path: '/products/upload-excel',
    name: 'ProductUploadExcel',
    component: () => import('../views/orders/ExcelUpload.vue'),
    meta: { title: 'Import Products', parent: 'ProductList' }
  },
  {
    path: '/products/:id/edit',
    name: 'ProductEdit',
    component: () => import('../views/products/ProductForm.vue'),
    meta: { title: 'Edit Product', parent: 'ProductList' },
    props: true
  },
  {
    path: '/factories',
    name: 'FactoryList',
    component: () => import('../views/factories/FactoryList.vue'),
    meta: { title: 'Factories', icon: 'pi-building' }
  },
  {
    path: '/factories/new',
    name: 'FactoryNew',
    component: () => import('../views/factories/FactoryForm.vue'),
    meta: { title: 'New Factory', parent: 'FactoryList' }
  },
  {
    path: '/factories/:id/edit',
    name: 'FactoryEdit',
    component: () => import('../views/factories/FactoryForm.vue'),
    meta: { title: 'Edit Factory', parent: 'FactoryList' },
    props: true
  },
  {
    path: '/clients',
    name: 'ClientList',
    component: () => import('../views/clients/ClientList.vue'),
    meta: { title: 'Clients', icon: 'pi-users' }
  },
  {
    path: '/clients/new',
    name: 'ClientNew',
    component: () => import('../views/clients/ClientForm.vue'),
    meta: { title: 'New Client', parent: 'ClientList' }
  },
  {
    path: '/clients/:id/edit',
    name: 'ClientEdit',
    component: () => import('../views/clients/ClientForm.vue'),
    meta: { title: 'Edit Client', parent: 'ClientList' },
    props: true
  },

  // Transport / Service Providers
  {
    path: '/transport',
    name: 'TransportList',
    component: () => import('../views/transport/TransportList.vue'),
    meta: { title: 'Service Providers', icon: 'pi-truck' }
  },
  {
    path: '/transport/new',
    name: 'TransportNew',
    component: () => import('../views/transport/TransportForm.vue'),
    meta: { title: 'New Service Provider', parent: 'TransportList' }
  },
  {
    path: '/transport/:id/edit',
    name: 'TransportEdit',
    component: () => import('../views/transport/TransportForm.vue'),
    meta: { title: 'Edit Service Provider', parent: 'TransportList' },
    props: true
  },

  // === Tracking ===
  {
    path: '/after-sales',
    name: 'AfterSales',
    component: () => import('../views/AfterSales.vue'),
    meta: { title: 'After-Sales', icon: 'pi-exclamation-triangle' }
  },
  {
    path: '/finance',
    component: () => import('../views/finance/FinanceLayout.vue'),
    meta: { title: 'Finance', icon: 'pi-chart-line' },
    children: [
      { path: '', redirect: '/finance/receivables' },
      { path: 'receivables', name: 'Receivables', component: () => import('../views/finance/Receivables.vue'), meta: { title: 'Receivables' } },
      { path: 'client-ledger', name: 'ClientLedger', component: () => import('../views/finance/ClientLedger.vue'), meta: { title: 'Client Ledger' } },
      { path: 'factory-ledger', name: 'FactoryLedger', component: () => import('../views/finance/FactoryLedger.vue'), meta: { title: 'Factory Ledger' } },
    ],
  },
  {
    path: '/returns-pending',
    name: 'ReturnsPending',
    component: () => import('../views/ReturnsPending.vue'),
    meta: { title: 'Returns & Pending', icon: 'pi-replay' }
  },
  {
    path: '/warehouse',
    name: 'WarehouseStock',
    component: () => import('../views/WarehouseStock.vue'),
    meta: { title: 'Warehouse Stock', icon: 'pi-warehouse' }
  },

  // === Settings ===
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue'),
    meta: { title: 'Settings', icon: 'pi-cog' }
  },

  // === Tech Stack ===
  {
    path: '/tech-stack',
    name: 'TechStack',
    component: () => import('../views/TechStack.vue'),
    meta: { title: 'Tech Stack', icon: 'pi-code', roles: ['ADMIN'] }
  },

  // === Audit Logs ===
  {
    path: '/audit-logs',
    name: 'AuditLogs',
    component: () => import('../views/AuditLogs.vue'),
    meta: { title: 'Audit Trail', icon: 'pi-list', roles: ['ADMIN'] }
  },

  // === Product Review ===
  {
    path: '/products/review',
    name: 'ProductReview',
    component: () => import('../views/products/ProductReview.vue'),
    meta: { title: 'Product Review', icon: 'pi-check-square', roles: ['ADMIN'] }
  },

  // === Users ===
  {
    path: '/users',
    name: 'Users',
    component: () => import('../views/Users.vue'),
    meta: { title: 'Users', icon: 'pi-users', roles: ['ADMIN'] }
  },

  // === Login ===
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { title: 'Login', public: true }
  },

  // === Access Denied ===
  {
    path: '/access-denied',
    name: 'AccessDenied',
    component: () => import('../views/AccessDenied.vue'),
    meta: { title: 'Access Denied' }
  },

  // === Client Portal ===
  {
    path: '/client-portal',
    component: () => import('../components/layout/ClientLayout.vue'),
    meta: { requiresAuth: true, userType: 'CLIENT' },
    children: [
      {
        path: '',
        name: 'ClientDashboard',
        component: () => import('../views/client/ClientDashboard.vue'),
        meta: { title: 'Dashboard', requiresAuth: true, userType: 'CLIENT' }
      },
      {
        path: 'orders',
        name: 'ClientOrders',
        component: () => import('../views/client/ClientOrders.vue'),
        meta: { title: 'My Orders', requiresAuth: true, userType: 'CLIENT' }
      },
      {
        path: 'orders/new',
        name: 'ClientNewOrder',
        component: () => import('../views/client/ClientNewOrder.vue'),
        meta: { title: 'New Order Inquiry', requiresAuth: true, userType: 'CLIENT' }
      },
      {
        path: 'orders/:id',
        name: 'ClientOrderDetail',
        component: () => import('../views/client/ClientOrderDetail.vue'),
        meta: { title: 'Order Detail', requiresAuth: true, userType: 'CLIENT' },
        props: true
      },
      {
        path: 'products',
        name: 'ClientProducts',
        component: () => import('../views/client/ClientProducts.vue'),
        meta: { title: 'Products', requiresAuth: true, userType: 'CLIENT' }
      },
      {
        path: 'ledger',
        name: 'ClientPortalLedger',
        component: () => import('../views/client/ClientLedger.vue'),
        meta: { title: 'Statement of Account', requiresAuth: true, userType: 'CLIENT' }
      },
      {
        path: 'shipments',
        name: 'ClientShipments',
        component: () => import('../views/client/ClientShipments.vue'),
        meta: { title: 'Shipments', requiresAuth: true, userType: 'CLIENT' }
      },
      {
        path: 'after-sales',
        name: 'ClientAfterSales',
        component: () => import('../views/client/ClientAfterSales.vue'),
        meta: { title: 'After-Sales', requiresAuth: true, userType: 'CLIENT' }
      },
      {
        path: 'returns-pending',
        name: 'ClientReturnsPending',
        component: () => import('../views/client/ClientReturnsPending.vue'),
        meta: { title: 'Returns & Pending', requiresAuth: true, userType: 'CLIENT' }
      },
      {
        path: 'profile',
        name: 'ClientProfile',
        component: () => import('../views/client/ClientProfile.vue'),
        meta: { title: 'Profile', requiresAuth: true, userType: 'CLIENT' }
      },
    ]
  },

  // === Factory Portal ===
  {
    path: '/factory-portal',
    component: () => import('../components/layout/FactoryLayout.vue'),
    meta: { requiresAuth: true, userType: 'FACTORY' },
    children: [
      {
        path: '',
        name: 'FactoryDashboard',
        component: () => import('../views/factory/FactoryDashboard.vue'),
        meta: { title: 'Dashboard', requiresAuth: true, userType: 'FACTORY' }
      },
      {
        path: 'orders',
        name: 'FactoryOrders',
        component: () => import('../views/factory/FactoryOrders.vue'),
        meta: { title: 'Orders', requiresAuth: true, userType: 'FACTORY' }
      },
      {
        path: 'orders/:id',
        name: 'FactoryOrderDetail',
        component: () => import('../views/factory/FactoryOrderDetail.vue'),
        meta: { title: 'Order Detail', requiresAuth: true, userType: 'FACTORY' },
        props: true
      },
      {
        path: 'production',
        name: 'FactoryProduction',
        component: () => import('../views/factory/FactoryOrders.vue'),
        meta: { title: 'Production', requiresAuth: true, userType: 'FACTORY' }
      },
      {
        path: 'packing',
        name: 'FactoryPacking',
        component: () => import('../views/factory/FactoryOrders.vue'),
        meta: { title: 'Packing', requiresAuth: true, userType: 'FACTORY' }
      },
      {
        path: 'profile',
        name: 'FactoryProfile',
        component: () => import('../views/factory/FactoryProfile.vue'),
        meta: { title: 'Profile', requiresAuth: true, userType: 'FACTORY' }
      },
    ]
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Set page title + Session hydration + Portal route guards
router.beforeEach(async (to, from, next) => {
  document.title = `${to.meta.title || 'HarvestERP'} - HarvestERP`

  // Public routes bypass auth
  if (to.meta.public) return next()

  // Access denied page — always allow
  if (to.path === '/access-denied') return next()

  // Lazy import to avoid circular deps
  const { useAuth } = await import('../composables/useAuth')
  const { token, user, initialized, restoreSession, getPortalPath } = useAuth()

  // Hydrate session if not yet initialized (page refresh)
  if (!initialized.value) {
    await restoreSession()
  }

  // If no token at all, redirect to login
  if (!token.value) {
    return next('/login')
  }

  // If token exists but user failed to load, redirect to login
  if (!user.value) {
    return next('/login')
  }

  // Authenticated user trying to visit /login → redirect to their portal
  if (to.path === '/login') {
    return next(getPortalPath())
  }

  // Portal isolation: CLIENT users can only access /client-portal
  if (user.value.user_type === 'CLIENT' && !to.path.startsWith('/client-portal')) {
    return next('/client-portal')
  }

  // Portal isolation: FACTORY users can only access /factory-portal
  if (user.value.user_type === 'FACTORY' && !to.path.startsWith('/factory-portal')) {
    return next('/factory-portal')
  }

  // Internal users should not access external portals
  if (user.value.user_type === 'INTERNAL') {
    if (to.path.startsWith('/client-portal') || to.path.startsWith('/factory-portal')) {
      return next('/dashboard')
    }
  }

  // Role-based route protection (e.g., meta.roles: ['ADMIN'])
  if (to.meta.roles && to.meta.roles.length > 0) {
    const hasAccess = to.meta.roles.includes(user.value.role) || user.value.role === 'ADMIN' || user.value.role === 'SUPER_ADMIN'
    if (!hasAccess) {
      return next('/access-denied')
    }
  }

  next()
})

export default router
