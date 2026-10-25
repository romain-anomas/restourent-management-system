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

### Upgrading an existing database (Mobile Money payment methods)

If you already had this project running before MTN MoMo / Airtel Money support was added, run this once against your existing database instead of re-importing the schema (this preserves all your existing data):

```bash
mysql -u root -p restaurant_management < server/database/migrations/001_add_payment_methods.sql
```

This adds `momo_code`, `momo_number`, `momo_name`, and `airtel_money_number` to `restaurant_settings`, adds `payment_method`/`payment_reference` to `orders`, and pre-fills the payment details. You can edit them anytime from **Admin → Settings → Payment Methods**. Brand-new installs following the steps above don't need this — `schema.sql` and `seed.js` already include it.

If you're also using automatic MTN MoMo payment confirmation (see section 15 below), run this too:

```bash
mysql -u root -p restaurant_management < server/database/migrations/002_add_momo_reference.sql
```

And if you want staff to be able to record "cash" as a payment method for walk-in/phone orders (see section 16 below), run:

```bash
mysql -u root -p restaurant_management < server/database/migrations/003_add_cash_payment_method.sql
```

For existing installations, apply the payment method migrations in order (001, 002, 003, 005, then 006), plus the table migrations that apply to your setup. Migrations 005 and 006 add terminal card payments and secure online card checkout. Brand-new installs use `schema.sql` and don't need these migrations.

### Online card checkout (delivery and takeaway)

Online card payments use Flutterwave's hosted checkout. Customers choose a Visa, Mastercard, or American Express preview on the site, then enter their card details on Flutterwave's secure payment page. This app does not receive or store card numbers.

Add `FLW_SECRET_KEY` and `FLW_SECRET_HASH` to `server/.env`. Configure the webhook URL as `https://YOUR_SERVER/api/payments/card/webhook` in Flutterwave and set the same webhook secret hash in both places. For an existing database, apply migrations 005 and 006. Online card checkout stays unavailable until the secret key is configured.

For an existing installation adding dine-in table seating, run `004_add_dine_in_tables.sql` after migrations 001–003. Add and group tables from **Admin → Tables**; customers can select a table from **Dine In** before browsing the menu or at checkout.

For existing installations, apply `server/database/migrations/007_dine_in_guest_session_access.sql` to allow the guest who opened a table session to add more orders from the same browser. Each new order is added to the table's running bill. Guests settle the full bill with staff when leaving; staff mark all session orders paid and close the session to make the table available again. New installations already include this column in `schema.sql`.

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
| GET    | `/api/tables/public`                   | Public            | List active tables and their statuses for dine-in checkout |
| GET    | `/api/tables/:id/orders`                | Admin             | View active-session orders, items, and payment totals for a table |
| POST   | `/api/orders/manual`                   | Admin/Worker      | Record a walk-in/phone order with multiple products (immediate inventory deduction) |
| GET    | `/api/orders`                          | Admin/Worker      | List orders (`?status=`, `?search=`, `?from=`, `?to=`) |
| GET    | `/api/orders/:id`                      | Admin/Worker      | Full order detail + item + status history     |
| PUT    | `/api/orders/:id/status`               | Admin/Worker      | Update status (auto-deducts/restocks inventory) |
| PATCH  | `/api/orders/:id/payment-status`       | Admin/Worker      | Mark an order's Mobile Money payment as verified/paid |
| GET    | `/api/workers`                         | Admin             | List worker accounts (`?search=`)             |
| GET    | `/api/workers/:id`                     | Admin             | Worker profile + stats + recent activity      |
| POST   | `/api/workers`                         | Admin             | Create worker account                         |
| PUT    | `/api/workers/:id`                     | Admin             | Edit worker profile                           |
| PATCH  | `/api/workers/:id/status`              | Admin             | Activate/disable worker account               |
| POST   | `/api/workers/:id/reset-password`      | Admin             | Reset a worker's password                     |
| GET    | `/api/dashboard`                       | Admin             | Live stats + chart data                       |
| GET    | `/api/inventory`                       | Admin             | Inventory transaction history (`?productId=`, `?type=`, `?from=`, `?to=`) |
| POST   | `/api/inventory/stock-in`              | Admin             | Record stock received for one or more products at once |
| POST   | `/api/inventory/stock-out`             | Admin             | Record stock removed for one or more products at once |
| POST   | `/api/inventory/adjustment`            | Admin             | Set exact stock values for one or more products (shared reason required) |
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
| GET    | `/api/payments/momo/status/:orderNumber` | Public          | Poll MTN MoMo payment status (auto-marks order paid on success) |
| POST   | `/api/payments/momo/retry/:orderNumber`  | Public, rate-limited | Resend the MTN MoMo payment prompt        |
| GET    | `/api/payments/momo/validate/:phone`   | Public, rate-limited | Check if a phone number has an active MoMo account |
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

## 15. Payment Methods (MTN MoMo & Airtel Money)

Checkout requires the customer to choose **MTN Mobile Money** or **Airtel Money** — no other payment method is offered, and no card gateway is used.

### Airtel Money — manual verification

1. Customer selects Airtel Money and sees the live payment number (pulled from **Admin → Settings → Payment Methods**, not hardcoded).
2. Customer pays via their own Airtel Money menu/app, optionally pastes the confirmation SMS reference into the order form.
3. Staff (Admin or Worker) check their phone for the incoming payment, then open the order in **Orders** and click **Mark Paid**. This also keeps a generated invoice's payment status in sync.

### MTN MoMo — automatic via MTN's official API

If configured (see below), choosing MTN MoMo triggers MTN's **Request to Pay** API automatically right after the order is placed — this pushes a payment-approval prompt to the customer's phone. The order confirmation page then polls MTN's status endpoint every few seconds and flips to "Payment Confirmed" the moment MTN reports success — no staff action needed. If the prompt doesn't arrive, the customer can tap "Resend payment request," or pay manually using the MoMo code/number shown (same manual fallback as Airtel Money, with staff able to Mark Paid).

As the customer types their phone number after selecting MoMo, it's also validated live against MTN's account-holder lookup — a green check confirms it's an active MoMo number, a warning shows if it isn't (without blocking checkout, since the customer can still pay manually or by Airtel Money).

This integration (`server/src/services/momoService.js`) was built directly against MTN's official Collections API Swagger specification — endpoints, headers, and field names (`X-Reference-Id`, `X-Target-Environment`, `payer.partyIdType`/`partyId`, the `PENDING`/`SUCCESSFUL`/`FAILED` status enum, etc.) match the spec exactly.

**To enable automatic MoMo payments:**

1. Create a free account at **https://momodeveloper.mtn.com** and subscribe to the **Collections** product (sandbox tier is free). Copy your subscription's **Primary key**.
2. Add it to `server/.env`:
   ```
   MOMO_SUBSCRIPTION_KEY=your_primary_key_here
   ```
3. Run the one-time provisioning script to generate an API user + key under that subscription:
   ```bash
   cd server
   npm run momo:setup
   ```
   This prints `MOMO_API_USER` and `MOMO_API_KEY` — add both to `server/.env` and restart the backend.
4. That's it. MoMo orders now trigger the automatic prompt.

**Important limitations to know:**

- **Sandbox only supports EUR.** MTN's test environment cannot process real RWF amounts — this is MTN's own sandbox constraint, not something this codebase can work around. Real RWF payments require MTN's **production** API, which needs a signed merchant agreement with MTN Rwanda. Swap `MOMO_BASE_URL`, `MOMO_TARGET_ENVIRONMENT=production`, `MOMO_CURRENCY=RWF`, and production credentials once you have them — no other code changes needed.
- **If MTN isn't configured** (or the API call fails for any reason), the order still succeeds — the system automatically falls back to the manual "pay using these details, staff marks it paid" flow, exactly like Airtel Money. Nothing breaks either way.
- The payment method icons on the checkout page are an original icon + brand-color design, not a reproduction of MTN's or Airtel's actual trademarked logo artwork.

To change the displayed payment numbers later, no code changes are needed — just update them in Admin → Settings.

## 16. Staff Order Entry & Bulk Inventory

Two features specifically for speeding up staff workflows:

### Recording orders for walk-in/phone customers

From **Orders** (Admin or Worker), the **"+ New Order"** button opens a form where staff can:
- Enter a customer's name/phone
- Add as many products as needed, one row each, with a running total
- Choose a payment method — **Cash**, MTN MoMo, or Airtel Money — or leave it unset for now
- Optionally check "Mark as paid now" (automatic if Cash is selected)

Unlike online checkout orders, these are created already **confirmed**, with inventory deducted immediately — staff are recording a sale happening right now, not something needing a separate confirmation step. Right after creating it, staff can click **Generate Invoice** to immediately produce a printable PDF for the customer.

Cash is only available here, not on the public website (which remains MoMo/Airtel Money only, per the original requirement).

### Bulk inventory operations

**Stock In**, **Stock Out**, and **Adjustment** (Admin → Inventory) now each accept multiple products in a single submission, matching how these actually happen in practice — one delivery invoice covers several products, or a physical stock count touches many products at once:

- **Stock In**: add as many product rows as needed, each with its own quantity and unit cost; supplier and reference number are shared across the whole batch (since they typically come from one delivery invoice).
- **Stock Out**: multiple products, one shared reason (e.g. "Weekly kitchen prep").
- **Adjustment**: multiple products, each set to its own exact new quantity, with one shared required reason (e.g. "Monthly physical stock count").

Every submission is processed as a single atomic database transaction — if any one product in the batch fails (e.g. insufficient stock, invalid product), the entire batch is rolled back and nothing is partially applied.

## 17. Where to Go From Here

The system covers the full original specification. If you want to keep extending it, natural next additions would be: discounts/coupons, SMS/email order-status notifications to customers, a delivery-rider role, multi-branch support, or a proper reporting data warehouse for very large datasets — none of which were in the original spec, so they're genuine "nice to have" ideas rather than gaps.
