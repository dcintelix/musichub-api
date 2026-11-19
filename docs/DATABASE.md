# Database design

The backend uses PostgreSQL with Prisma.

## Key principles

- UUID primary keys for cross-system portability.
- Explicit relations between tables.
- UTC timestamps for business records.
- Soft-deletion where required for history retention.
- Strong enum use for controlled states.
- Monetary values should use integer minor units or Decimal in future billing flows.

## Current models implemented

- User
- UserRole
- Role
- Permission
- RolePermission
- UserSession
- RefreshToken
- EmailVerificationToken
- PasswordResetToken
- UserPreference
- UserBlock
- MusicianProfile
- Organization
- MediaAsset

These cover the identity, authentication and media foundation required for the first delivery phase.
