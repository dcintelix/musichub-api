#  Backend

This repository contains the backend for the  platform, using NestJS, Prisma, PostgreSQL, Cloudflare R2, Resend and Socket.IO.

## Stack

- Node.js
- TypeScript
- NestJS
- Prisma
- PostgreSQL
- Cloudflare R2
- Resend
- Socket.IO
- JWT + Argon2id

## Prerequisites

- Node.js 22+
- PostgreSQL 16+
- npm
- A Cloudflare R2 account
- A Resend account

## Local setup

1. Copy `.env.example` to `.env` and configure the values.
2. Start PostgreSQL locally or use Docker Compose.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```
5. Start the API:
   ```bash
   npm run start:dev
   ```

## Available scripts

- `npm run build` (generates Prisma Client from `prisma/schema.prisma` before compilation)
- `npm run start:dev`
- `npm run start:prod`
- `npm run test`
- `npm run prisma:migrate`
- `npm run prisma:generate`
- `npm run seed`

## Phase 2: professional identity

The backend now includes the foundation for:

- musician profiles
- professions, instruments and genres
- location reference data
- portfolio and availability management
- organization creation and member assignment
- verification records

See `docs/PROFESSIONAL_IDENTITY.md` for the feature overview.

## Phase 3: communities and content

The backend now also includes:

- communities with public/private membership
- member requests and approvals
- post publishing and feed retrieval
- comments, replies and reactions
- basic poll support
- content reporting

See `docs/COMMUNITIES_AND_CONTENT.md` for the feature overview.

## Swagger

Open the API docs at:

`http://localhost:3000/docs`

## Health check

`GET /api/v1/health`

## Notes

This project is intentionally structured as a modular monolith for the first production-ready backend phase.
The implementation covers authentication, token issuance, email verification, profile creation and R2 upload flow as the initial milestone.
