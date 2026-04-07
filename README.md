# Beauty Business CRM — Frontend

A React + Tailwind CSS + Vite frontend for a beauty business CRM / POS system. Handles appointments, staff scheduling, memberships, payments, and customer management.

## Tech Stack

- React + TypeScript
- Tailwind CSS
- Vite
- Supabase (auth + database)
- Stripe (payments)

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Stripe](https://stripe.com) account
- The backend repo running (see `beauty-business-crm-backend`)

## Setup

1. Clone this repo
2. Go into the `app` directory

   ```
   cd app
   ```

3. Install dependencies

   ```
   npm install
   ```

4. Install the **Prettier VSCode extension** and add this to your `settings.json`:

   ```json
   {
     "editor.defaultFormatter": "esbenp.prettier-vscode",
     "editor.formatOnSave": true
   }
   ```

5. Create a `.env` file in the `app` directory:

   ```
   cp .env.example .env
   ```

   Then fill in the values (see [Environment Variables](#environment-variables) below).

6. Start the dev server (talks to local backend on port 8080):

   ```
   npm run dev
   # Visit http://127.0.0.1:5173
   ```

## Environment Variables

Create `app/.env` with the following:

```env
# Your Supabase project URL
# Found in: Supabase Dashboard > Project Settings > API > Project URL
VITE_SUPABASE_URL=https://your-project-id.supabase.co

# Your Supabase anon/public key
# Found in: Supabase Dashboard > Project Settings > API > anon public
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# URL of your running backend server
# Local: http://localhost:8080
# Deployed: https://your-backend-url.com
VITE_API_BASE_URL=http://localhost:8080

# Your Stripe publishable key (starts with pk_)
# Found in: Stripe Dashboard > Developers > API keys
VITE_STRIPE_PUBLIC_KEY=pk_test_your_stripe_publishable_key
```

## Outlet Configuration

This frontend supports **one or multiple outlets**. Outlets are loaded dynamically from the backend — no hardcoded changes are needed here for adding/removing outlets.

### Single Outlet

- The outlet selector in the UI will simply show one option — no additional changes needed.
- Update `OUTLET_1_IMAGE` and `OUTLET_2_IMAGE` in `app/client/src/lib/constants.ts` to a single image URL if you only have one outlet. You can reuse the same URL for both constants or leave the second one unused.

### Multiple Outlets

- Each outlet is fetched from the backend `/api/outlets` endpoint.
- To add a new outlet, insert it into the `outlets` table in Supabase (or via `db/seed.sql` in the backend repo).
- Update `app/client/src/lib/constants.ts` to add image URLs for each outlet — one constant per outlet.

---

## Customisation Checklist

Before going live, replace the following placeholders in the codebase:

| File | What to Replace |
|------|----------------|
| `app/.env` | All env vars — Supabase URL, anon key, API base URL, Stripe publishable key |
| `app/client/src/lib/constants.ts` | `OUTLET_1_IMAGE` and `OUTLET_2_IMAGE` — replace placeholder URLs with your own outlet images |
| `app/client/src/pages/login.tsx` | Swap out the logo file in `app/client/src/assets/` with your own business logo |
| `app/client/src/pages/staffs.tsx` | Update the team description text |
| `app/client/src/pages/services.tsx` | Update the services description text |

## Deployment

This project is configured for deployment on [Render](https://render.com) or any static hosting provider. Update `VITE_API_BASE_URL` to point to your deployed backend.
