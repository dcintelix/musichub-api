# Professional identity module

This phase adds the data and API foundation for musician identity and organization membership.

## Included features

- Reference data for professions, instruments, genres and locations.
- Musician profiles with portfolio items and availability windows.
- Skill and genre associations.
- Organization creation and member assignment.
- Verification workflow records.

## API summary

- `GET /api/v1/professions`
- `POST /api/v1/professions`
- `GET /api/v1/instruments`
- `POST /api/v1/instruments`
- `GET /api/v1/genres`
- `POST /api/v1/genres`
- `GET /api/v1/locations`
- `POST /api/v1/locations`
- `POST /api/v1/organizations`
- `GET /api/v1/organizations/:id`
- `POST /api/v1/organizations/:id/members`
- `GET /api/v1/verification/me`
- `POST /api/v1/verification/me`

These endpoints are intentionally lightweight and suitable for the initial profile milestone.
