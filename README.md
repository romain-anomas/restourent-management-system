# Tasty Bites — Restaurant Business Management & Online Ordering System

A full-stack restaurant management platform: public ordering website, worker order dashboard, and admin business-management dashboard (inventory, worker stock/salary deductions, invoices, expenses, reports).

**Status: Phases 1–4 complete.** Project setup, full MySQL schema (all 14 tables), JWT authentication with Admin/Worker RBAC, and the full public customer website (home, menu, product details, cart, checkout, real order placement, order confirmation) are built and working end-to-end against the real database. Admin/Worker dashboards remain scaffolded as placeholders and will be filled in phase by phase — see "Roadmap" below.

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

## 10. API Overview (Phases 1–4)

| Method | Endpoint                          | Auth        | Description                                |
|--------|-------------------------------------|-------------|----------------------------------------------|
| POST   | `/api/auth/login`                   | Public      | Login (body: email, password, role)          |
| GET    | `/api/auth/me`                       | Bearer JWT  | Get current logged-in user                    |
| POST   | `/api/auth/change-password`          | Bearer JWT  | Change your own password                      |
| POST   | `/api/auth/logout`                   | Bearer JWT  | Logout (logs activity)                        |
| GET    | `/api/categories`                     | Public      | List active categories                        |
| GET    | `/api/products`                       | Public      | List active products (filters: category, search, limit) |
| GET    | `/api/products/:id`                   | Public      | Product details                               |
| POST   | `/api/orders`                         | Public      | Place a new order (checkout)                  |
| GET    | `/api/orders/track/:orderNumber`      | Public      | Look up an order by its order number          |
| GET    | `/api/settings/public`                | Public      | Restaurant name/contact/hours for the website |
| GET    | `/api/health`                          | Public      | Server health check                           |

All future endpoints (admin product/category CRUD, worker order handling, inventory, workers, worker-stock, salary-deductions, expenses, reports, dashboard, notifications) will follow the same pattern: `authenticate` middleware + `authorize('admin')` / `authorize('admin','worker')` as appropriate, matching the spec's route list. Note: admin-only write endpoints for `/api/categories` and `/api/products` (create/edit/delete/deactivate) are added in Phase 5, in the same route files.

## 11. Security Notes

- Passwords hashed with bcrypt (never stored/returned in plain text)
- JWT-based auth; tokens expire (`JWT_EXPIRES_IN`)
- Role checked on the **backend** via middleware — the frontend's route guards are UX only, not the real security boundary
- Rate limiting on the login endpoint
- Helmet + CORS configured
- `.env` is gitignored; only `.env.example` is committed — never commit real credentials

## 12. Roadmap (next phases)

- ~~**Phase 4:** Public website — home, menu, product details, cart, checkout, order confirmation~~ ✅ Done
- **Phase 5:** Admin — dashboard stats, product/category/order/worker CRUD
- **Phase 6:** Inventory — stock in/out/adjustment, low-stock alerts, inventory history
- **Phase 7:** Worker stock-taking + salary deduction approval workflow
- **Phase 8:** Invoices — generation, printing, PDF
- **Phase 9:** Reports — daily/weekly/monthly/custom, with export
- **Phase 10:** Expenses + profit calculation
- **Phase 11:** Polish — full responsive QA, notifications, validation hardening, more tests

Each phase will be delivered as a zip of new/changed files to merge into this same project folder, with a clear list of what's new vs. updated.

## 13. Known Limitations (current phase)

- Admin/Worker dashboard pages beyond auth/profile are still placeholders ("Coming Soon") — routes and layout exist, backend logic comes in Phase 5+.
- Product images: the schema/upload path exists but the admin image-upload UI comes in Phase 5. Products currently seed without images (shown as a letter avatar on the site).
- Invoicing and reporting are not yet implemented.
- No WebSocket/real-time order updates yet (planned for the worker order dashboard in Phase 6/7).
- "Forgot password" is intentionally disabled for now — per the spec, workers/admins get resets from the Admin panel (built in Phase 5).
- Orders placed on the public site do not yet deduct inventory — that happens when a worker/admin confirms the order (Phase 6), per the spec's business rules.

