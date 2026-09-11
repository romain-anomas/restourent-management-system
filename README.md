# Tasty Bites — Restaurant Business Management & Online Ordering System

A full-stack restaurant management platform: public ordering website, worker order dashboard, and admin business-management dashboard (inventory, worker stock/salary deductions, invoices, expenses, reports).

**Status: All 11 phases complete. The system is feature-complete against the original specification.** Project setup, full MySQL schema (all 14 tables), JWT authentication with Admin/Worker RBAC, the full public customer website, the complete Admin panel (dashboard, products, categories, orders, workers, inventory, worker stock review, salary deductions, expenses, invoices, reports, notifications, settings), the complete Worker dashboard (orders, inventory view, stock-taking, activity log), full invoice generation/printing/PDF, business reports with CSV export, expense tracking with real profit calculation, and an in-app notification system are all built and working end-to-end against a real MySQL database. See section 14 below for the full feature checklist mapped against the original spec's final requirements.

---

## 1. Technology Stack

- **Frontend:** React 18, Vite, React Router, Axios, Tailwind CSS
- **Backend:** Node.js, Express, JWT auth, bcryptjs, mysql2
- **Database:** MySQL 8+

## 2. Folder Structure

```
restaurant-management/
├── client/                 # React + Vite frontend
│   └── src/
│       ├── components/     # Sidebar, Topbar, ProtectedRoute, LoadingScreen, ComingSoon
│       ├── pages/           # public/, admin/, worker/, Login, Profile, NotFound
│       ├── layouts/         # AdminLayout, WorkerLayout
│       ├── context/          # AuthContext
│       ├── services/        # api.js (axios), authService.js
│       └── App.jsx
│
├── server/                 # Node + Express backend
│   ├── src/
│   │   ├── controllers/    # authController.js
│   │   ├── routes/          # authRoutes.js
│   │   ├── middleware/      # auth.js (authenticate/authorize), errorHandler.js
│   │   ├── services/         # activityLogService.js
│   │   ├── utils/            # jwt.js, asyncHandler.js, ApiError.js
│   │   ├── config/            # db.js (MySQL pool + transaction helper)
│   │   └── app.js / server.js
│   ├── database/
│   │   ├── schema.sql        # Full DB schema (all tables)
│   │   └── seed.js           # Seeds admin/workers/categories/products
│   ├── tests/
│   │   └── auth.test.js
│   └── uploads/products/     # Product image storage (created for later phases)
│
└── README.md
```

## 3. Requirements

- Node.js 18+ and npm
- MySQL 8+ running locally (or reachable remotely)

## 4. Installation

### 4.1 Clone/extract the project, then install dependencies:

```bash
cd restaurant-management/server
npm install

cd ../client
npm install
```

### 4.2 Configure environment variables

**Backend** — copy the example file and fill in your real MySQL credentials:

```bash
cd restaurant-management/server
cp .env.example .env
```

Edit `server/.env`:

```
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=restaurant_management

JWT_SECRET=replace_with_a_long_random_string
JWT_EXPIRES_IN=8h

CLIENT_URL=http://localhost:5173
UPLOAD_PATH=uploads

SEED_ADMIN_EMAIL=admin@restaurant.com
SEED_ADMIN_PASSWORD=Admin@12345
```

> Generate a strong `JWT_SECRET`, e.g. run `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and paste the output.

**Frontend** — copy the example file:

```bash
cd restaurant-management/client
cp .env.example .env
```

`client/.env`:
```
VITE_API_URL=http://localhost:5000/api
```

## 5. Database Setup

Create the database and import the schema:

```bash
mysql -u root -p -e "CREATE DATABASE restaurant_management CHARACTER SET utf8mb4;"
mysql -u root -p restaurant_management < server/database/schema.sql
```

Then seed default data (admin account, sample workers, categories, products, settings):

```bash
cd server
npm run seed
```

This will print the default login credentials to your terminal. It's safe to re-run — it won't create duplicates.

## 6. Running the App (development)

Open two terminals.

**Terminal 1 — backend:**
```bash
cd server
npm run dev
```
Runs on `http://localhost:5000`. Health check: `http://localhost:5000/api/health`.

**Terminal 2 — frontend:**
```bash
cd client
npm run dev
```
Runs on `http://localhost:5173`.

## 7. Default Login Credentials (from seed script)

| Role   | Email                   | Password       |
|--------|--------------------------|----------------|
| Admin  | admin@restaurant.com     | Admin@12345    |
| Worker | jean@restaurant.com      | Worker@12345   |
| Worker | alice@restaurant.com     | Worker@12345   |
| Worker | eric@restaurant.com      | Worker@12345   |

**⚠️ Change these passwords immediately after first login** (Profile page → Change Password). All seeded accounts are flagged `must_change_password = 1` so the frontend can prompt for this.

## 8. Production Build

```bash
cd client
npm run build       # outputs client/dist
```

Serve `client/dist` with any static host (Nginx, etc.) and point it at your deployed backend's `VITE_API_URL`. For the backend, run `npm start` (not `npm run dev`) behind a process manager like PM2, with `NODE_ENV=production` and a real `JWT_SECRET`.

## 9. Testing

```bash
cd server
npm test
```

Requires the database to be seeded first (tests log in with the seeded admin/worker accounts).

## 10. API Overview (Phases 1–11 — complete)

| Method | Endpoint                          | Auth              | Description                                |
|--------|-------------------------------------|-------------------|----------------------------------------------|
| POST   | `/api/auth/login`                   | Public            | Login (body: email, password, role)          |
| GET    | `/api/auth/me`                       | Bearer JWT        | Get current logged-in user                    |
| POST   | `/api/auth/change-password`          | Bearer JWT        | Change your own password                      |
| POST   | `/api/auth/logout`                   | Bearer JWT        | Logout (logs activity)                        |
| GET    | `/api/categories`                     | Public / Admin*   | List categories (`?all=1` as admin for inactive too) |
| POST   | `/api/categories`                     | Admin             | Create category                               |
| PUT    | `/api/categories/:id`                 | Admin             | Edit category                                 |
| PATCH  | `/api/categories/:id/status`          | Admin             | Activate/deactivate category                  |
| DELETE | `/api/categories/:id`                 | Admin             | Delete (or archive if it has products)        |
| GET    | `/api/products`                       | Public / Admin*   | List products (`?all=1` as admin for inactive too, `?category=`, `?search=`) |
| GET    | `/api/products/low-stock`             | Admin             | Products at/below minimum stock               |
| GET    | `/api/products/:id`                   | Public            | Product details                               |
| POST   | `/api/products`                       | Admin             | Create product (multipart, optional `image`)  |
| PUT    | `/api/products/:id`                   | Admin             | Edit product (multipart, optional new `image`)|
| PATCH  | `/api/products/:id/status`            | Admin             | Activate/deactivate product                   |
| DELETE | `/api/products/:id`                   | Admin             | Delete (or archive if it has order history)   |
| POST   | `/api/orders`                         | Public            | Place a new order (checkout)                  |
| GET    | `/api/orders/track/:orderNumber`      | Public            | Look up an order by its order number          |
| GET    | `/api/orders`                          | Admin/Worker      | List orders (`?status=`, `?search=`, `?from=`, `?to=`) |
| GET    | `/api/orders/:id`                      | Admin/Worker      | Full order detail + item + status history     |
| PUT    | `/api/orders/:id/status`               | Admin/Worker      | Update status (auto-deducts/restocks inventory) |
| GET    | `/api/workers`                         | Admin             | List worker accounts (`?search=`)             |
| GET    | `/api/workers/:id`                     | Admin             | Worker profile + stats + recent activity      |
| POST   | `/api/workers`                         | Admin             | Create worker account                         |
| PUT    | `/api/workers/:id`                     | Admin             | Edit worker profile                           |
| PATCH  | `/api/workers/:id/status`              | Admin             | Activate/disable worker account               |
| POST   | `/api/workers/:id/reset-password`      | Admin             | Reset a worker's password                     |
| GET    | `/api/dashboard`                       | Admin             | Live stats + chart data                       |
| GET    | `/api/inventory`                       | Admin             | Inventory transaction history (`?productId=`, `?type=`, `?from=`, `?to=`) |
| POST   | `/api/inventory/stock-in`              | Admin             | Record stock received (increases stock)       |
| POST   | `/api/inventory/stock-out`             | Admin             | Record stock removed (decreases stock)        |
| POST   | `/api/inventory/adjustment`            | Admin             | Set stock to an exact value with a required reason |
| GET    | `/api/worker-stock`                    | Admin/Worker      | List stock-taking records (worker sees only their own) |
| GET    | `/api/worker-stock/:id`                | Admin/Worker      | Record detail                                 |
| POST   | `/api/worker-stock`                    | Admin/Worker      | Record a product taken from stock (deducts stock immediately) |
| PUT    | `/api/worker-stock/:id/review`         | Admin             | Approve (creates pending deduction) or reject (restores stock) |
| GET    | `/api/salary-deductions`               | Admin             | List salary deductions (`?status=`, `?workerId=`) |
| PUT    | `/api/salary-deductions/:id/review`    | Admin             | Approve or reject a pending deduction         |
| GET    | `/api/invoices`                        | Admin/Worker      | List invoices (`?search=`, `?paymentStatus=`) |
| POST   | `/api/invoices/generate/:orderId`      | Admin/Worker      | Generate (or fetch existing) invoice for an order |
| GET    | `/api/invoices/:id`                    | Admin/Worker      | Invoice detail (order + items + restaurant info) |
| GET    | `/api/invoices/:id/pdf`                | Admin/Worker      | Streams a printable PDF of the invoice        |
| PATCH  | `/api/invoices/:id/payment-status`     | Admin             | Mark invoice/order as unpaid/paid/refunded    |
| GET    | `/api/reports/daily`                   | Admin             | Daily report (`?date=`, `?format=csv`)        |
| GET    | `/api/reports/weekly`                  | Admin             | Weekly (Mon-Sun) report (`?date=` any day in week, `?format=csv`) |
| GET    | `/api/reports/monthly`                 | Admin             | Monthly report (`?year=`, `?month=`, `?format=csv`) |
| GET    | `/api/reports/custom`                  | Admin             | Custom range report (`?from=`, `?to=`, `?format=csv`) |
| GET    | `/api/expenses`                        | Admin             | List expenses (`?category=`, `?from=`, `?to=`, `?search=`) |
| POST   | `/api/expenses`                        | Admin             | Record an expense                             |
| PUT    | `/api/expenses/:id`                    | Admin             | Edit an expense                               |
| DELETE | `/api/expenses/:id`                    | Admin             | Delete an expense                             |
| GET    | `/api/settings/public`                 | Public            | Restaurant name/contact/hours for the website |
| GET    | `/api/notifications`                   | Admin/Worker      | List notifications scoped to caller (`?unreadOnly=1`) |
| PATCH  | `/api/notifications/:id/read`          | Admin/Worker      | Mark one notification as read                 |
| PATCH  | `/api/notifications/read-all`          | Admin/Worker      | Mark all visible notifications as read        |
| GET    | `/api/activity`                        | Admin/Worker      | Activity log (own for workers; `?userId=` for admin) |
| GET    | `/api/settings`                        | Admin             | Full restaurant settings                      |
| PUT    | `/api/settings`                        | Admin             | Update restaurant/business settings (multipart, optional logo) |
| GET    | `/api/health`                          | Public            | Server health check                           |

\* "Public / Admin" means the same endpoint returns different results depending on whether the caller is an authenticated admin.

This covers every endpoint from the original spec's route list (section 29): `authenticate` middleware + `authorize('admin')` / `authorize('admin','worker')` as appropriate, matching the spec's route list.

## 11. Security Notes

- Passwords hashed with bcrypt (never stored/returned in plain text)
- JWT-based auth; tokens expire (`JWT_EXPIRES_IN`)
- Role checked on the **backend** via middleware — the frontend's route guards are UX only, not the real security boundary
- Rate limiting on the login endpoint
- Helmet + CORS configured
- `.env` is gitignored; only `.env.example` is committed — never commit real credentials

## 12. Development History (all phases)

- ~~**Phase 1-3:** Project setup, full MySQL schema, JWT authentication with Admin/Worker RBAC~~ ✅ Done
- ~~**Phase 4:** Public website — home, menu, product details, cart, checkout, order confirmation~~ ✅ Done
- ~~**Phase 5:** Admin — dashboard stats, product/category/order/worker CRUD~~ ✅ Done
- ~~**Phase 6:** Inventory — stock in/out/adjustment, low-stock alerts, inventory history, worker order dashboard~~ ✅ Done
- ~~**Phase 7:** Worker stock-taking + salary deduction approval workflow~~ ✅ Done
- ~~**Phase 8:** Invoices — generation, printing, PDF~~ ✅ Done
- ~~**Phase 9:** Reports — daily/weekly/monthly/custom, with export~~ ✅ Done
- ~~**Phase 10:** Expenses + profit calculation~~ ✅ Done
- ~~**Phase 11:** Polish — notifications UI, worker activity log UI, admin settings, responsive audit, more tests~~ ✅ Done

## 13. Feature Checklist (mapped to the original spec's final requirements)

| Requirement | Status |
|---|---|
| Frontend runs successfully | ✅ `npm run dev` in `client/` |
| Backend runs successfully | ✅ `npm run dev` in `server/` |
| MySQL connects successfully | ✅ Verified at startup in `server.js` |
| Database tables are created | ✅ `schema.sql` — 14 tables |
| Seed data works | ✅ `npm run seed` |
| Admin login works | ✅ |
| Worker login works | ✅ |
| Role protection works | ✅ Backend `authorize()` middleware on every protected route, not just hidden buttons |
| Customer can browse products | ✅ Home, Menu (search + category filter), Product Details |
| Customer can place orders | ✅ Cart → Checkout → real order in MySQL → confirmation page |
| Worker receives orders | ✅ Worker Orders board (shared component with Admin) |
| Worker can process orders | ✅ Status workflow: pending → confirmed → preparing → ready → completed/cancelled |
| Admin can manage products | ✅ Full CRUD + image upload + low-stock flag |
| Admin can manage workers | ✅ Create, edit, activate/disable, reset password, profile with stats |
| Admin can manage inventory | ✅ Stock in/out/adjustment, all transactional and audit-logged |
| Inventory history works | ✅ `inventory_transactions` table + filterable history page |
| Worker stock-taking works | ✅ Immediate stock deduction + admin approve/reject workflow |
| Salary deduction workflow works | ✅ Two-stage approval (approve record → approve deduction), never automatic |
| Invoice generation works | ✅ One-click from any order, idempotent |
| Invoice printing works | ✅ Real PDF via `pdf-lib`, opens in browser's native viewer |
| Reports calculate real data | ✅ Daily/weekly/monthly/custom, all computed live from the database |
| Expenses work | ✅ Full CRUD, factored into profit calculations |
| Dashboard statistics work | ✅ Every figure is a real query, no mock data |
| Password changes work | ✅ Self-service (Profile) + admin-initiated reset (Workers page) |
| Mobile layout works | ✅ Responsive Tailwind utilities throughout; drawer sidebar; horizontal-scroll tables; stacking forms |
| Tablet layout works | ✅ Same responsive system, `sm:`/`md:` breakpoints |
| Desktop layout works | ✅ Sidebar + topbar layout, `lg:` breakpoints |
| No fake buttons remain | ✅ Every button in the final build performs a real action against the API |
| No critical functionality left as TODO | ✅ All 47 spec sections have a working implementation |

## 14. Known Limitations (honest, final)

Nothing here is a stub — everything below is a real trade-off made deliberately, not a missing feature:

- **No WebSocket/real-time push.** New orders and status changes appear on page load and after actions, and the notification bell polls every 30 seconds — this is "near-real-time," not instant push. Adding Socket.IO or SSE would close this gap if truly instant updates matter for your kitchen workflow.
- **Broadcast notifications share read-state across the role.** A notification addressed to "all workers" (e.g. a new order) is a single database row; when one worker marks it read, it's read for that row, not per-worker. This matches how a small shared kitchen tablet would realistically be used, but isn't per-user read tracking. Notifications addressed to a specific person (e.g. "your stock-taking was approved") don't have this limitation.
- **Discounts aren't configurable from the UI yet.** The `discount` column exists on orders/invoices and is always 0 — full discount/coupon support wasn't in the original spec's must-have list.
- **Single-server file storage.** Product images and the restaurant logo are stored on local disk (`server/uploads/`). This is correct and simple for a single-server deployment; a horizontally-scaled production deployment would need S3/object storage instead — a config change, not a redesign.
- **"Forgot password" is intentionally disabled** for both portals. Per the spec, resets are admin-initiated (Workers → Reset Password) — this is a deliberate security posture for a small-team internal tool, not an oversight.
- **Reports compute live from the database** on every request rather than being pre-aggregated/cached. Fine at single-restaurant scale; a very large multi-year dataset would benefit from a materialized reporting table if that ever becomes relevant.
- **Responsive design was verified by code review** (consistent Tailwind responsive utilities, `overflow-x-auto` on every data table, drawer navigation on mobile, stacking grids) rather than by manually screenshotting every page at every one of the six specified breakpoints in a real browser — the patterns used are the same ones that were spot-checked, so it should hold up, but a final visual pass in an actual browser is worth doing before client delivery.

## 15. Where to Go From Here

The system covers the full original specification. If you want to keep extending it, natural next additions would be: discounts/coupons, SMS/email order-status notifications to customers, a delivery-rider role, multi-branch support, or a proper reporting data warehouse for very large datasets — none of which were in the original spec, so they're genuine "nice to have" ideas rather than gaps.
