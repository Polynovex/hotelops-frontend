# HotelOpX Frontend (v3)

This package contains the HotelOpX web dashboard built with React + TypeScript + MUI.

## Scripts

- `npm run dev` - Start local development server
- `npm run build` - Production build
- `npm run lint` - Lint source files
- `npm run test` - Run Jest tests (requires Jest dependencies)
- `npm run e2e:cypress` - Run Cypress e2e tests (requires Cypress dependency)
- `npm run storybook` - Start Storybook (requires Storybook dependencies)

## Environment

Use `.env.example` as the template for local configuration.

- `VITE_API_URL` should point to the backend API root (default: `http://localhost:3000/api`).
- `VITE_ENABLE_DEMO_MODE=true` enables offline demo login/data. Set to `false` to force backend-only auth/data.

## Current Scope

- Role-based routing for super-admin and business users
- POS flow (orders + KDS)
- Accounting flow (chart, journals, bank, budgets, fixed assets, reports)
- Super-admin flow (businesses, plans, system health)
