# Inventory App

A multi-platform inventory management system for tracking stock, who took what, and current counts across locations.

## Stack

| Layer            | Tech                                               |
| ---------------- | -------------------------------------------------- |
| Website          | Next.js 15 (App Router) + TypeScript + Tailwind v4 |
| Mobile (iOS/And) | Flutter                                            |
| Backend / Auth   | Supabase (PostgreSQL + Auth + Row Level Security)  |

## Repository layout

```
Inventory-app/
├── web/        Next.js website (TypeScript, Tailwind, shadcn/ui style)
├── mobile/     Flutter app (Android + iOS)
├── supabase/   Database migrations, auth policies, local config
└── docs/       Architecture notes
```

Each subdirectory has its own README with setup steps.

## Quick start

```bash
# Website
cd web && npm install && npm run dev

# Mobile (after installing Flutter SDK)
cd mobile && flutter pub get && flutter run

# Supabase (after installing Supabase CLI)
cd supabase && supabase start
```

## Environment variables

Each app reads its Supabase URL + anon key from its own `.env` file. See:

- [web/.env.example](web/.env.example)
- [mobile/.env.example](mobile/.env.example)

## Features (planned)

- [x] Authentication (email + password via Supabase Auth)
- [ ] Item catalog with stock counts per location
- [ ] Check-out / check-in flow (who took what, when)
- [ ] Activity log per item and per user
- [ ] Low-stock notifications
