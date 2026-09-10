# Tasty Bites — Restaurant Business Management & Online Ordering System

A full-stack restaurant management platform: public ordering website, worker order dashboard, and admin business-management dashboard (inventory, worker stock/salary deductions, invoices, expenses, reports).

**Status: Phases 1–9 complete.** Project setup, full MySQL schema (all 14 tables), JWT authentication with Admin/Worker RBAC, the full public customer website, the Admin panel (dashboard, products, categories, orders, workers, inventory), the Worker dashboard, the full worker stock-taking + salary deduction approval workflow, invoice generation/printing/PDF, and daily/weekly/monthly/custom business reports (with CSV export and print support) are all built and working end-to-end against the real database. Expenses remain scaffolded as a placeholder and will be filled in the next phase — see "Roadmap" below.

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

## 10. API Overview (Phases 1–9)

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
| GET    | `/api/settings/public`                 | Public            | Restaurant name/contact/hours for the website |
| GET    | `/api/health`                          | Public            | Server health check                           |

\* "Public / Admin" means the same endpoint returns different results depending on whether the caller is an authenticated admin.

The future expenses endpoint will follow the same pattern: `authenticate` middleware + `authorize('admin')` / `authorize('admin','worker')` as appropriate, matching the spec's route list.

## 11. Security Notes

- Passwords hashed with bcrypt (never stored/returned in plain text)
- JWT-based auth; tokens expire (`JWT_EXPIRES_IN`)
- Role checked on the **backend** via middleware — the frontend's route guards are UX only, not the real security boundary
- Rate limiting on the login endpoint
- Helmet + CORS configured
- `.env` is gitignored; only `.env.example` is committed — never commit real credentials

## 12. Roadmap (next phases)

- ~~**Phase 4:** Public website — home, menu, product details, cart, checkout, order confirmation~~ ✅ Done
- ~~**Phase 5:** Admin — dashboard stats, product/category/order/worker CRUD~~ ✅ Done
- ~~**Phase 6:** Inventory — stock in/out/adjustment, low-stock alerts, inventory history, worker order dashboard~~ ✅ Done
- ~~**Phase 7:** Worker stock-taking + salary deduction approval workflow~~ ✅ Done
- ~~**Phase 8:** Invoices — generation, printing, PDF~~ ✅ Done
- ~~**Phase 9:** Reports — daily/weekly/monthly/custom, with export~~ ✅ Done
- **Phase 10:** Expenses + profit calculation
- **Phase 11:** Polish — full responsive QA, notifications, validation hardening, more tests

Each phase will be delivered as a zip of new/changed files to merge into this same project folder, with a clear list of what's new vs. updated.

## 13. Known Limitations (current phase)

- Expenses are not yet tracked (Phase 10), so every report's "Expenses" figure is currently always 0 and "Estimated Profit" = Revenue − Cost of Goods Sold only, not true net profit. This is called out directly in the Reports and Dashboard UI via the figures themselves; once Phase 10 adds the expenses module, this will automatically start reflecting real operating expenses.
- Reports are calculated live from the database on each request - there is no caching/materialization, so very large date ranges on a big dataset could take longer to compute; not a concern at typical single-restaurant scale.
- The in-app Notifications page is still a placeholder — notification rows are already being created in the database (new orders, worker stock-takings, salary deduction reviews) via the `notifications` table, but there's no UI to browse/mark them read yet.
- Worker activity log page is still a placeholder - the `activity_logs` table is already populated for every significant action, just not yet exposed as a worker-facing "My Activity" screen.
- No WebSocket/real-time updates yet — pages show live data on load and after actions, but won't auto-refresh when another user makes a change elsewhere. Manual refresh works fine in the meantime.
- "Forgot password" is intentionally disabled for now — per the spec, workers/admins get resets from the Admin panel (already available: Workers → reset password).
- Product image uploads are stored on local disk under `server/uploads/products/` — fine for development/single-server deployment; a production deployment behind multiple app servers would need shared/object storage instead.
