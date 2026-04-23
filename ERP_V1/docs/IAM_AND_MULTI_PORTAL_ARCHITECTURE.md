# IAM & Multi-Portal Architecture

**System:** HarvestERP v1.0
**Date:** 2026-03-22
**Author:** Principal IAM Architect
**Classification:** CONFIDENTIAL

---

## 1. Executive Summary

HarvestERP is transitioning from an internal-only tool to a **multi-portal supply chain platform** serving three distinct user populations:

| Population | Portal | Count | Access Pattern |
|---|---|---|---|
| Internal Staff | Admin Portal | 5-20 users | Full management, all data |
| Indian Buyers | Client Portal | 50-200 users | Own orders, payments, shipments |
| Chinese Suppliers | Factory Portal | 10-50 users | Production status, packing lists |

Each population sees a **different slice of the same data** with strict field-level filtering and row-level isolation.

---

## 2. The Five Roles

| Role | Type | Description | Portal |
|---|---|---|---|
| **ADMIN** | Internal | Superuser. Full CRUD on all modules. User management, settings, audit trail. | Admin Portal (`/dashboard`) |
| **FINANCE** | Internal | Financial controller. Payments, ledgers, receivables, exchange rates, credits. Read-only on operational data. | Admin Portal (`/dashboard`) |
| **OPERATIONS** | Internal | Sales reps & logistics. Orders, products, factories, shipping, customs, after-sales. Full operational CRUD. | Admin Portal (`/dashboard`) |
| **CLIENT** | External | Indian buyers (farmers/dealers). View own orders, PI, payments, shipment tracking, after-sales claims. | Client Portal (`/client-portal`) |
| **FACTORY** | External | Chinese suppliers. View assigned orders, update production progress, upload packing lists. | Factory Portal (`/factory-portal`) |

---

## 3. Global Permission Matrix (CRUD)

### 3.1 Master Data

| Module | ADMIN | FINANCE | OPERATIONS | CLIENT | FACTORY |
|--------|-------|---------|------------|--------|---------|
| **Products** | CRUD | Read | CRUD | Read (name, code, image only) | Read (name, code, image only) |
| **Product Images** | CRUD | Read | CRUD | Read | Read |
| **Factories** | CRUD | Read (no bank) | CRUD | None | Read (own profile only) |
| **Factory Bank Details** | CRUD | Read | Read | None | Read (own only) |
| **Clients** | CRUD | Read | CRUD | Read (own profile only) | None |
| **Client Tax IDs** | CRUD | Read | Read | Read (own only) | None |
| **Service Providers** | CRUD | Read | CRUD | None | None |
| **HSN Tariffs** | CRUD | Read | Read | None | None |
| **Categories & Markups** | CRUD | Read | Read | None | None |
| **Exchange Rates** | CRUD | CRUD | Read | None | None |
| **System Settings** | CRUD | None | None | None | None |

### 3.2 Order Workflow (17 Stages)

| Action | ADMIN | FINANCE | OPERATIONS | CLIENT | FACTORY |
|--------|-------|---------|------------|--------|---------|
| **List Orders** | All | All | All | Own orders only | Assigned orders only |
| **View Order Detail** | Full | Full | Full | Limited (no factory prices, no markup) | Limited (no selling prices, no markup) |
| **Create Order** | Yes | No | Yes | No | No |
| **Edit Order** | Yes | No | Yes (DRAFT only) | No | No |
| **Delete Order** | Yes | No | Yes (DRAFT only) | No | No |
| **Add/Edit Items** | Yes | No | Yes (DRAFT/PENDING_PI) | No | No |
| **Set Prices** | Yes | No | Yes | No | No |
| **Advance Stage** | Yes | Yes (financial stages) | Yes | No | No |
| **Go Back Stage** | Yes | No | Yes | No | No |
| **Jump Stage** | Yes | No | No | No | No |
| **Reopen Order** | Yes | No | No | No | No |
| **View Timeline** | Yes | Yes | Yes | Yes (own) | Yes (assigned) |
| **Upload Packing List** | Yes | No | Yes | No | Yes (assigned) |
| **Download Packing List** | Yes | Yes | Yes | Yes (own) | Yes (assigned) |
| **View Production Progress** | Yes | No | Yes | Yes (own) | Yes (assigned, update) |
| **Update Production Progress** | Yes | No | Yes | No | Yes (assigned) |

### 3.3 Finance & Payments

| Action | ADMIN | FINANCE | OPERATIONS | CLIENT | FACTORY |
|--------|-------|---------|------------|--------|---------|
| **Client Payments** | CRUD | CRUD | Read | Read (own) | None |
| **Factory Payments** | CRUD | CRUD | Read | None | Read (own, no INR amounts) |
| **Client Ledger** | Read+Download | Read+Download | Read | Read (own) | None |
| **Factory Ledger** | Read+Download | Read+Download | Read | None | Read (own) |
| **Receivables** | Read | Read | Read | Read (own balance) | None |
| **Client Credits** | CRUD | CRUD | Read | Read (own) | None |
| **Factory Credits** | CRUD | CRUD | Read | None | Read (own) |
| **Payment Audit Log** | Read | Read | None | None | None |
| **PI Generation** | Yes | Yes | Yes | None | None |
| **PI Download** | Yes | Yes | Yes | Yes (own) | None |

### 3.4 Shipping & Customs

| Action | ADMIN | FINANCE | OPERATIONS | CLIENT | FACTORY |
|--------|-------|---------|------------|--------|---------|
| **Shipments** | CRUD | Read | CRUD | Read (own) | Read (assigned) |
| **Shipment Phase Updates** | Yes | No | Yes | No | No |
| **Shipping Documents** | CRUD | Read | CRUD | Read (own) | Upload (assigned) |
| **Bill of Entry** | CRUD | Read | CRUD | None | None |
| **Customs Milestones** | CRUD | Read | CRUD | Read (own) | None |
| **Clearance Charges** | CRUD | CRUD | Read | None | None |

### 3.5 After-Sales & Operations

| Action | ADMIN | FINANCE | OPERATIONS | CLIENT | FACTORY |
|--------|-------|---------|------------|--------|---------|
| **After-Sales Items** | CRUD | Read | CRUD | Read+Create (own) | Read (assigned) |
| **Upload Photos** | Yes | No | Yes | Yes (own claims) | No |
| **Resolve Claims** | Yes | No | Yes | No | No |
| **Unloaded Items** | CRUD | Read | CRUD | None | None |
| **Warehouse Stock** | Read | Read | Read | None | None |

### 3.6 Admin & System

| Action | ADMIN | FINANCE | OPERATIONS | CLIENT | FACTORY |
|--------|-------|---------|------------|--------|---------|
| **Audit Trail** | Read | None | None | None | None |
| **User Management** | CRUD | None | None | None | None |
| **Tech Stack** | Read | None | None | None | None |
| **Excel Import** | Yes | No | Yes | No | Yes (factory Excel) |

---

## 4. Field-Level Data Filtering

### 4.1 What Clients NEVER See

```python
CLIENT_HIDDEN_FIELDS = [
    "factory_price_cny",        # Our cost — reveals our margin
    "factory_price_usd",        # Our cost in USD
    "markup_percent",           # Profit percentage
    "factory_id",               # Which factory supplies them
    "factory_name",             # Factory identity
    "factory_payments",         # What we pay the factory
    "factory_ledger",           # Factory transaction history
    "exchange_rate",            # CNY/INR conversion rate
    "internal_notes",           # Staff observations about client
    "cancel_note",              # Why items were cancelled
    "igst_credit_*",            # Tax credit details
    "clearance_charges",        # Customs duty breakdown
    "freight_cost_inr",         # Shipping costs
    "bank_*" (factory/provider), # Banking details
]
```

### 4.2 What Factories NEVER See

```python
FACTORY_HIDDEN_FIELDS = [
    "selling_price_inr",        # What we charge the client
    "selling_price_cny",        # Selling in CNY
    "markup_percent",           # Our profit margin
    "client_id",                # Who the buyer is
    "client_name",              # Client identity
    "client_payments",          # What client pays us
    "client_ledger",            # Client transaction history
    "client_credits",           # Client credit balances
    "receivables",              # Outstanding from clients
    "internal_notes",           # Staff observations
    "igst_credit_*",            # Indian tax details
    "proforma_invoice",         # PI with selling prices
    "compensation_amount",      # After-sales payouts to client
]
```

### 4.3 Implementation: Response Serializer Pattern

```python
# core/serializers.py

def filter_order_for_role(order_dict: dict, role: str) -> dict:
    """Strip sensitive fields based on user role."""
    result = {**order_dict}  # Immutable copy

    if role == "CLIENT":
        for field in CLIENT_HIDDEN_FIELDS:
            result.pop(field, None)
        # Strip factory prices from nested items
        if "items" in result:
            result["items"] = [
                {k: v for k, v in item.items() if k not in CLIENT_HIDDEN_FIELDS}
                for item in result["items"]
            ]

    elif role == "FACTORY":
        for field in FACTORY_HIDDEN_FIELDS:
            result.pop(field, None)
        if "items" in result:
            result["items"] = [
                {k: v for k, v in item.items() if k not in FACTORY_HIDDEN_FIELDS}
                for item in result["items"]
            ]

    return result
```

---

## 5. Row-Level Security (Data Isolation)

### 5.1 The Isolation Model

```
                    ┌─────────────────┐
                    │   All Orders    │
                    │   (Full Table)  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼──────┐ ┌────▼────┐ ┌───────▼───────┐
     │ INTERNAL USER │ │ CLIENT  │ │   FACTORY     │
     │ sees ALL      │ │ sees    │ │ sees orders   │
     │ orders        │ │ WHERE   │ │ WHERE         │
     │               │ │ client  │ │ factory_id =  │
     │               │ │ _id =   │ │ user.factory  │
     │               │ │ user.   │ │ _id           │
     │               │ │ client  │ │               │
     │               │ │ _id     │ │ + field filter│
     └───────────────┘ └─────────┘ └───────────────┘
```

### 5.2 User Model Extension

```python
class User(Base):
    __tablename__ = "users"

    id: str          # UUID
    email: str       # Login identifier
    password_hash: str
    role: str        # ADMIN | FINANCE | OPERATIONS | CLIENT | FACTORY
    user_type: str   # INTERNAL | CLIENT | FACTORY

    # External user linkage (NULL for internal users)
    client_id: Optional[str]   # FK → clients.id (for CLIENT users)
    factory_id: Optional[str]  # FK → factories.id (for FACTORY users)

    is_active: bool
    last_login: datetime
    created_at: datetime
```

### 5.3 FastAPI Dependency: Tenant-Scoped Query

```python
# core/security.py

def get_scoped_query(model, db: Session, user: CurrentUser):
    """Apply row-level security to any query based on user role."""
    q = db.query(model)

    if user.role == "CLIENT":
        if hasattr(model, 'client_id'):
            q = q.filter(model.client_id == user.client_id)
        elif hasattr(model, 'order_id'):
            # Subquery: only items belonging to client's orders
            client_orders = db.query(Order.id).filter(
                Order.client_id == user.client_id
            ).subquery()
            q = q.filter(model.order_id.in_(client_orders))

    elif user.role == "FACTORY":
        if hasattr(model, 'factory_id'):
            q = q.filter(model.factory_id == user.factory_id)
        elif hasattr(model, 'order_id'):
            factory_orders = db.query(Order.id).filter(
                Order.factory_id == user.factory_id
            ).subquery()
            q = q.filter(model.order_id.in_(factory_orders))

    return q
```

### 5.4 Example: Client Sees Only Their Orders

```python
@router.get("/")
def list_orders(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = get_scoped_query(Order, db, current_user)
    orders = q.filter(Order.deleted_at.is_(None)).all()

    # Field-level filter per role
    return [
        filter_order_for_role(serialize_order(o, db), current_user.role)
        for o in orders
    ]
```

### 5.5 Isolation Verification Checklist

| Scenario | Guard | Implementation |
|---|---|---|
| Client A requests Client B's order | `order.client_id != user.client_id` | `get_scoped_query` filters at DB level |
| Factory X requests Factory Y's items | `order.factory_id != user.factory_id` | `get_scoped_query` filters at DB level |
| Client requests factory price | Field not in response | `filter_order_for_role` strips field |
| Factory requests selling price | Field not in response | `filter_order_for_role` strips field |
| Client accesses `/api/settings/` | 403 Forbidden | Router-level `require_admin` dependency |
| Factory accesses `/api/finance/` | 403 Forbidden | Router-level `require_finance` dependency |
| Client manipulates `client_id` in URL | Query re-filtered | `get_scoped_query` ignores URL param, uses JWT |

---

## 6. Authentication Routing Architecture

### 6.1 Unified Login Endpoint

**Decision: Single `/api/auth/login` endpoint** with `user_type` detection.

```
POST /api/auth/login
Body: { "email": "user@example.com", "password": "..." }

Response:
{
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "user": {
        "id": "uuid",
        "email": "user@example.com",
        "role": "CLIENT",
        "user_type": "CLIENT",       // INTERNAL | CLIENT | FACTORY
        "client_id": "uuid-or-null",
        "factory_id": "uuid-or-null",
        "portal": "/client-portal"   // Frontend redirect target
    }
}
```

**Why unified:**
- Single auth codebase, single JWT issuer
- Role is embedded in JWT — no separate auth services
- Frontend reads `user.portal` from response and redirects

### 6.2 JWT Payload Structure

```json
{
    "sub": "user-uuid",
    "email": "user@example.com",
    "role": "CLIENT",
    "user_type": "CLIENT",
    "client_id": "client-uuid",
    "factory_id": null,
    "tenant_id": "default",
    "iat": 1711100000,
    "exp": 1711100900
}
```

### 6.3 Frontend Portal Routing

```javascript
// router/index.js

const portalRoutes = {
    // Internal users → Admin Portal
    INTERNAL: {
        redirect: '/dashboard',
        layout: 'AdminLayout',
        routes: [/* all current routes */],
    },
    // Client users → Client Portal
    CLIENT: {
        redirect: '/client-portal',
        layout: 'ClientLayout',
        routes: [
            { path: '/client-portal', component: ClientDashboard },
            { path: '/client-portal/orders', component: ClientOrders },
            { path: '/client-portal/orders/:id', component: ClientOrderDetail },
            { path: '/client-portal/payments', component: ClientPayments },
            { path: '/client-portal/shipments', component: ClientShipments },
            { path: '/client-portal/after-sales', component: ClientAfterSales },
            { path: '/client-portal/profile', component: ClientProfile },
        ],
    },
    // Factory users → Factory Portal
    FACTORY: {
        redirect: '/factory-portal',
        layout: 'FactoryLayout',
        routes: [
            { path: '/factory-portal', component: FactoryDashboard },
            { path: '/factory-portal/orders', component: FactoryOrders },
            { path: '/factory-portal/orders/:id', component: FactoryOrderDetail },
            { path: '/factory-portal/production', component: FactoryProduction },
            { path: '/factory-portal/packing', component: FactoryPackingUpload },
            { path: '/factory-portal/profile', component: FactoryProfile },
        ],
    },
}
```

### 6.4 Login Flow

```
User visits /login
        │
    Enters email + password
        │
    POST /api/auth/login
        │
    Backend:
      1. Find user by email
      2. Verify password (bcrypt)
      3. Determine user_type from user record
      4. Generate JWT with role + client_id/factory_id
      5. Return token + portal redirect path
        │
    Frontend:
      1. Store token in httpOnly cookie (via Set-Cookie header)
      2. Read user.portal from response
      3. router.push(user.portal)
        │
    ┌────────────┬────────────┬────────────┐
    │ INTERNAL   │ CLIENT     │ FACTORY    │
    │ /dashboard │ /client-   │ /factory-  │
    │            │ portal     │ portal     │
    └────────────┴────────────┴────────────┘
```

### 6.5 Route Guard (Vue Router)

```javascript
router.beforeEach(async (to, from, next) => {
    const { user, fetchUser } = useAuth()

    // Public routes (login, forgot password)
    if (to.meta.public) return next()

    // Ensure user is loaded
    if (!user.value) await fetchUser()

    // Not authenticated → login
    if (!user.value) return next('/login')

    // Portal isolation: prevent cross-portal access
    if (to.path.startsWith('/client-portal') && user.value.user_type !== 'CLIENT') {
        return next('/access-denied')
    }
    if (to.path.startsWith('/factory-portal') && user.value.user_type !== 'FACTORY') {
        return next('/access-denied')
    }
    if (!to.path.startsWith('/client-portal') && !to.path.startsWith('/factory-portal')
        && user.value.user_type !== 'INTERNAL') {
        return next(user.value.portal)  // Redirect external users to their portal
    }

    // Role check on meta.roles
    if (to.meta.roles && !to.meta.roles.includes(user.value.role)) {
        return next('/access-denied')
    }

    next()
})
```

---

## 7. Client Portal — Feature Scope

| Page | Data Shown | Actions |
|---|---|---|
| **Dashboard** | Active orders count, shipment status, outstanding balance | Quick links |
| **My Orders** | Order list (own only) with status, stage, PI total | View detail, filter by status |
| **Order Detail** | Items (name, code, qty, **selling price only**), PI, shipment tracking | Download PI, view timeline |
| **My Payments** | Payment history (own orders) | View only |
| **Shipment Tracking** | Container, vessel, ETD/ETA, sailing phase, documents | Track shipment |
| **After-Sales** | Own claims with status, photos | Create claim, upload photos |
| **Profile** | Company info, contact details | Update contact info |

**Client NEVER sees:** Factory prices, markup %, factory name, factory payments, exchange rates, internal notes, other clients' data, settings, audit logs.

---

## 8. Factory Portal — Feature Scope

| Page | Data Shown | Actions |
|---|---|---|
| **Dashboard** | Active orders assigned, production milestones due | Quick links |
| **My Orders** | Orders where `factory_id = user.factory_id` | View detail |
| **Order Detail** | Items (name, code, qty, **factory price only**), packing list | Upload packing list |
| **Production** | Milestone tracking (%, date, photos) | Update progress, upload photos |
| **Packing Upload** | Excel upload for packing list | Upload, preview |
| **Profile** | Factory info, contacts, bank details | Update own info |

**Factory NEVER sees:** Selling prices, markup %, client name, client payments, receivables, other factories' data, settings, audit logs, PI documents.

---

## 9. Implementation Phases

### Phase A: User Management (1 week)
- Create `users` table with role, user_type, client_id, factory_id
- Implement password hashing (bcrypt)
- Build `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`
- Replace stub `get_current_user` with real JWT decode
- Admin UI for user CRUD

### Phase B: Row-Level Security (1 week)
- Implement `get_scoped_query` dependency
- Apply to all list/detail endpoints
- Add ownership verification to all mutation endpoints
- Field-level filtering via `filter_order_for_role`

### Phase C: Client Portal (2 weeks)
- `ClientLayout.vue` — minimal sidebar (Dashboard, Orders, Payments, Shipments, After-Sales, Profile)
- 7 new Vue views under `/client-portal/`
- Dedicated serializers that strip factory data
- Client self-registration or admin-created accounts

### Phase D: Factory Portal (2 weeks)
- `FactoryLayout.vue` — minimal sidebar (Dashboard, Orders, Production, Packing, Profile)
- 6 new Vue views under `/factory-portal/`
- Dedicated serializers that strip client/selling data
- WeChat/mobile-friendly responsive design (factory users are often on phones)
- Chinese language support (i18n)

### Phase E: Portal Testing & Hardening (1 week)
- Cross-portal access testing (Client tries Factory URL)
- Field leakage testing (verify no factory prices in Client responses)
- Row isolation testing (Client A tries Client B's order_id)
- Penetration testing on JWT manipulation

---

## 10. Security Boundaries Summary

```
┌─────────────────────────────────────────────────────────┐
│                    INTERNET                              │
│                                                          │
│    ┌──────────┐   ┌──────────────┐   ┌──────────────┐   │
│    │ Client   │   │   Admin      │   │  Factory     │   │
│    │ Portal   │   │   Portal     │   │  Portal      │   │
│    │ /client- │   │  /dashboard  │   │  /factory-   │   │
│    │  portal  │   │              │   │   portal     │   │
│    └────┬─────┘   └──────┬───────┘   └──────┬───────┘   │
│         │                │                   │           │
│    ┌────▼────────────────▼───────────────────▼────┐      │
│    │              Vue Router Guard                │      │
│    │         (portal isolation + role check)       │      │
│    └────────────────────┬────────────────────────┘      │
│                         │                                │
│    ┌────────────────────▼────────────────────────┐      │
│    │              FastAPI Backend                  │      │
│    │                                              │      │
│    │  Layer 1: JWT Auth (get_current_user)         │      │
│    │  Layer 2: RBAC (require_role)                 │      │
│    │  Layer 3: Row Filter (get_scoped_query)       │      │
│    │  Layer 4: Field Filter (filter_for_role)      │      │
│    │  Layer 5: Audit Log (log_audit_event)         │      │
│    │                                              │      │
│    └────────────────────┬────────────────────────┘      │
│                         │                                │
│    ┌────────────────────▼────────────────────────┐      │
│    │              PostgreSQL                       │      │
│    │         (encrypted, pooled, backed up)         │      │
│    └─────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────┘
```

**Five layers of defense — breach of one does not expose data from another.**

---

*Generated from comprehensive inventory of 100+ API endpoints, 30+ Vue views, and 32 database tables.*
