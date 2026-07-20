# Nakshathra Scheme Platform

Production-oriented TypeScript monorepo containing three role-isolated portals and a transactional MongoDB API.

## Project structure

```text
apps/
  api/
    server.ts                 Express entry point
    src/config/               Environment, MongoDB and logging
    src/controllers/          Role-specific request/response handlers
    src/middlewares/          Authentication, validation and error handling
    src/models/               One Mongoose schema per file
    src/routes/               Admin, staff and customer routes
    src/services/             Shared domain/business logic
    src/validators/           Zod request schemas
    src/workers/              Transactional outbox worker
  web/
    src/apps/admin/           Admin portal
    src/apps/staff/           Staff mobile portal
    src/apps/customer/        Customer mobile portal
    src/shared/               Shared UI, API client, hooks and styles
    src/store/                Authentication state
```

## Requirements

- Node.js 22.13 or newer
- npm 10 or newer
- MongoDB Atlas or another replica set (transactions are required)

## Install and run

1. From this project root, install packages:

   ```bash
   npm install
   ```

2. Create the API environment file:

   ```bash
   cp apps/api/.env.example apps/api/.env
   ```

3. Set `MONGODB_URI` in `apps/api/.env`. Replace all placeholder secrets before production use.

4. Seed local test users and sample scheme data:

   ```bash
   npm run seed
   ```

5. Start both API and web apps:

   ```bash
   npm run dev
   ```

Open `http://localhost:5173`. The API listens on `http://localhost:4000`.

Seed logins use password `Nakshathra@123`:

- Admin: `+919999999901`
- Staff: `+919999999902`
- Customer: `+919999999903`

## Useful commands

```bash
npm run dev:api
npm run dev:web
npm run typecheck
npm run build
npm test
```

## PhonePe localhost testing

Keep `PHONEPE_ENABLED=false` until sandbox credentials are configured. A real PhonePe webhook cannot call a localhost address; expose the API through a temporary HTTPS tunnel and register:

```text
https://YOUR-TUNNEL/api/v1/gateway/phonepe/webhook
```

Never commit `.env` files or real credentials.
