# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Common commands

### Install dependencies
- `npm install`

### Run the development server
- `npm run dev`
  - Uses `node --watch src/index.js` to start the Express server with file watching.
  - Entrypoint: `src/index.js` (loads environment via `dotenv/config.js` and starts `src/server.js`).

### Database and migrations (Drizzle + Neon)
- Generate migration files from the schema in `src/models/*.js` (configured in `drizzle.config.js`):
  - `npm run db:generate`
- Run pending migrations against the database referenced by `DATABASE_URL`:
  - `npm run db:migrate`
- Open Drizzle Studio for inspecting schema/data:
  - `npm run db:studio`

These commands rely on the `DATABASE_URL` environment variable being set (see `drizzle.config.js` and `src/config/database.js`).

### Test the database connection manually
- `node test-connection.js`
  - Uses `@neondatabase/serverless` with `DATABASE_URL` to run a simple `SELECT version();` and prints a success or detailed error message.

### Linting and tests
- There are currently **no lint or test scripts** defined in `package.json`, and no test framework configured.
- If you introduce a linter (e.g., ESLint) or a test runner (e.g., Vitest/Jest), add the appropriate `scripts` entries in `package.json` (for example, `"lint"`, `"test"`) and update this `WARP.md` with:
  - How to run the full test suite.
  - How to run a single test (e.g., `npm test -- path/to/file.test.js` or framework-specific pattern).

## High-level architecture

### Runtime stack
- Node.js project using native ES modules (`"type": "module"` in `package.json`).
- HTTP server built with Express (`src/app.js`, `src/server.js`).
- PostgreSQL access via Neon serverless driver + Drizzle ORM (`src/config/database.js`, `src/models/user.model.js`).
- Logging via Winston (`src/config/logger.js`) with HTTP request logging via Morgan (`src/app.js`).
- Validation via Zod (`src/validations/auth.validation.js`).
- Authentication primitives using JSON Web Tokens and HTTP-only cookies (`src/utils/jwt.js`, `src/utils/cookies.js`).

### Module and import structure
- The project uses Node `imports` aliases declared in `package.json`:
  - `#src/*` → `./src/*`
  - `#config/*` → `./src/config/*`
  - `#controllers/*` → `./src/controllers/*`
  - `#middleware/*` → `./src/middleware/*`
  - `#models/*` → `./src/models/*`
  - `#routes/*` → `./src/routes/*`
  - `#services/*` → `./src/services/*`
  - `#utils/*` → `./src/utils/*`
  - `#validations/*` → `./src/validations/*`
- When adding new modules, prefer using these aliases for consistency (e.g., `#services/new-feature.service.js`).

### Application entrypoint and HTTP layer
- `src/index.js`
  - Loads environment configuration via `dotenv/config.js`.
  - Imports and runs `src/server.js`.
- `src/server.js`
  - Imports the Express app from `src/app.js`.
  - Binds the app to `process.env.PORT || 3000` and logs a startup message to stdout.
- `src/app.js`
  - Creates and configures the Express app.
  - Core middleware stack:
    - `helmet()` for security headers.
    - `cors()` for CORS handling (default configuration).
    - `express.json()` / `express.urlencoded({ extended: true })` for body parsing.
    - `cookie-parser` for cookie support.
    - `morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } })` for HTTP request logs forwarded into the shared Winston logger.
  - Routes:
    - `GET /` – basic health/info endpoint that logs and returns "Hello from Acquisitions!".
    - `GET /health` – healthcheck returning `{ status, timestamp, uptime }`.
    - `GET /api` – simple API liveness endpoint.
    - Mounts `authRoutes` under `/api/auth` (see `src/routes/auth.routes.js`).

### Auth domain: routing, controller, service, and model
- `src/routes/auth.routes.js`
  - Declares the auth router.
  - `POST /api/auth/sign-up` → `signup` controller in `src/controllers/auth.controller.js`.
  - `POST /api/auth/sign-in` and `POST /api/auth/sign-out` currently return placeholder JSON responses.
  - Future auth endpoints should be added here and wired to controllers.
- `src/controllers/auth.controller.js`
  - `signup(req, res, next)`:
    - Validates `req.body` using `signupSchema` from `src/validations/auth.validation.js`.
    - On validation failure, responds with HTTP 400 and an `error` plus flattened `details` message (via `formatValidationError`).
    - On success, destructures `name`, `email`, `password`, `role` from the validated data and calls `createUser` from `src/services/auth.service.js`.
    - Builds a JWT using `jwttoken.sign` (from `src/utils/jwt.js`) with payload `{ id, email, role }`.
    - Sets an HTTP-only cookie named `"token"` on the `res` object using `cookies.set` (from `src/utils/cookies.js`).
    - Logs successful registration through the shared `logger` and returns HTTP 201 with a minimal `user` payload.
    - Error handling: if `e.message === "User with this email already exists"`, responds with HTTP 409; otherwise delegates to Express error middleware via `next(e)`.
- `src/services/auth.service.js`
  - `hashPassword(password)` – wraps `bcrypt.hash` and logs/throws on errors.
  - `comparePassword(password, hashedPassword)` – wraps `bcrypt.compare` and logs/throws on errors.
  - `createUser({ name, email, password, role = "user" })`:
    - Uses Drizzle (`db` from `src/config/database.js`) and `users` table from `src/models/user.model.js`.
    - Performs a `SELECT` with `where(eq(users.email, email)).limit(1)` to enforce uniqueness at the application level; throws `"User with this email already exists"` if a record is found.
    - Hashes the incoming password, inserts a new row, and returns a subset of fields via `.returning({ id, name, email, role, created_at })`.
    - Logs both success and failure via the shared logger and rethrows errors for the controller to handle.
- `src/models/user.model.js`
  - Defines the `users` table using Drizzle's `pgTable`:
    - `id` serial primary key.
    - `name`, `email` (unique), `password`, `role` (default `"user"`).
    - `created_at` and `updated_at` timestamps with `defaultNow()`.
  - This schema is also used by Drizzle Kit (see `drizzle.config.js`) to generate migrations.

### Validation and utilities
- `src/validations/auth.validation.js`
  - `signupSchema` (Zod):
    - `name`: string, 2–255 characters, trimmed.
    - `email`: email format, max length 255, lowercased and trimmed.
    - `password`: string, length 6–128.
    - `role`: enum `"user" | "admin"`, default `"user"`.
  - `signInSchema`: email + password; currently not enforced in the `sign-in` route but available for future use.
- `src/utils/format.js`
  - `formatValidationError(errors)` – flattens a Zod-style errors object into a human-readable string:
    - If `errors.issues` is an array, joins message strings with `", "`.
    - Otherwise falls back to `JSON.stringify(errors)`.
  - Shared by controllers to keep validation error formatting consistent.
- `src/utils/cookies.js`
  - Centralizes cookie behavior:
    - `getOptions()` returns defaults: `httpOnly: true`, `secure` depending on `NODE_ENV`, `sameSite: "strict"`, and a 15-minute `maxAge`.
    - `set(res, name, value, options)` applies defaults and any overrides.
    - `clear(res, name, options)` clears with the same options pattern.
    - `get(req, name)` returns `req.cookies[name]`.
- `src/utils/jwt.js`
  - Wraps `jsonwebtoken` with logging on failures.
  - Uses `JWT_SECRET` from `process.env.JWT_SECRET` (with a non-production default) and a fixed expiry (`"1d"`).
  - Exposes:
    - `jwttoken.sign(payload)` – signs a payload, throwing an error if signing fails.
    - `jwttoken.verify(token)` – verifies a token, throwing an error if verification fails.

### Configuration and logging
- `src/config/database.js`
  - Imports `DATABASE_URL` from environment (via `dotenv/config`).
  - Creates a Neon serverless SQL client (`neon(DATABASE_URL)`) and Drizzle ORM instance (`drizzle(sql, { schema })`) using the `users` schema.
  - Exports both `db` (for ORM usage) and `sql` (raw queries, e.g., for scripts).
  - Contains commented-out configuration for a development Neon endpoint if running locally in a different network topology.
- `drizzle.config.js`
  - Drizzle Kit configuration:
    - `schema: "./src/models/*.js"` – source of table definitions.
    - `out: "./drizzle"` – directory for generated migration files.
    - `dialect: "postgresql"`.
    - `dbCredentials.url` – reads `process.env.DATABASE_URL`.
- `src/config/logger.js`
  - Configures a Winston logger with:
    - Log level from `process.env.LOG_LEVEL` or `"info"`.
    - Combined format with timestamps, error stacks, and JSON output.
    - File transports:
      - `logs/error.lg` for `error` level logs.
      - `logs/combined.log` for general logs.
  - In non-production environments (`NODE_ENV !== "production"`), adds a console transport using colorized, simple formatting for development ergonomics.
  - Shared across the app, including HTTP logging via Morgan and domain-specific logs in services/controllers.

## Notes for future Warp agents
- Before introducing new architectural pieces (e.g., additional domains beyond auth, background jobs, or a test runner), look for existing patterns in this stack:
  - Reuse the layered structure: route → controller → service → model.
  - Reuse shared utilities for JWTs, cookies, logging, and validation where possible.
- If you add or modify important commands (new `npm` scripts, new migration workflows, etc.), update the **Common commands** section above to keep this file accurate for subsequent agents.
