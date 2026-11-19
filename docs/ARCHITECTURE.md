# Architecture

The application intentionally uses a modular monolith structure built with NestJS.

## Layers

- Controllers: HTTP routes and request validation.
- Services: Business logic and orchestration.
- DTOs: Request/response contracts.
- Prisma service: Database access and transactions.
- Guards: Authentication and role enforcement.
- Filters: Global exception handling.
- Interceptors: Response shaping.

## Core modules

- `auth`: Registration, login, verification, JWT handling.
- `users`: User preferences and user data access.
- `profiles`: Profile management.
- `storage`: Authenticated media uploads streamed by the backend to Cloudflare R2, plus legacy presigning and media verification.
- `groups`: Group ownership, self-service membership and active member listing.
- `opportunities`: Opportunity publishing and organizer-managed applicant workflows.
- `users`: Preferences, follow connections, and saved opportunity lists.
- `health`: Service availability and DB check.
- `email`: Email delivery integration.

## Security principles

- Password hashing using Argon2id.
- JWT access tokens for authenticated requests.
- Refresh token rotation workflow.
- Global validation and filtered exceptions.
- Server-side authorization checks.
