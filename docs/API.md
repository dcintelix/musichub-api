# API overview

The API is mounted under `/api/v1`.

## Authentication endpoints

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me`

## User endpoints

- `GET /api/v1/users/me/preferences`
- `PATCH /api/v1/users/me/preferences`
- `GET /api/v1/users/me/following`
- `GET /api/v1/users/me/followers`
- `POST /api/v1/users/:userId/follow`
- `DELETE /api/v1/users/:userId/follow`
- `GET /api/v1/users/me/saved-opportunities`
- `POST /api/v1/users/me/saved-opportunities/:opportunityId`
- `DELETE /api/v1/users/me/saved-opportunities/:opportunityId`

Follow endpoints are limited to active users with public musician profiles. Saved opportunity endpoints are scoped to the authenticated user.

## Profiles endpoints

- `GET /api/v1/profiles?search=:term` (public musician discovery; public profiles only)
- `GET /api/v1/profiles/me`
- `POST /api/v1/profiles`
- `PATCH /api/v1/profiles/me`
- `GET /api/v1/profiles/me/availability`
- `PUT /api/v1/profiles/me/availability`
- `POST /api/v1/profiles/me/professions`
- `DELETE /api/v1/profiles/me/professions/:professionId`
- `POST /api/v1/profiles/me/instruments`
- `DELETE /api/v1/profiles/me/instruments/:instrumentId`
- `POST /api/v1/profiles/me/genres`
- `DELETE /api/v1/profiles/me/genres/:genreId`

## Posts and communities

- `GET /api/v1/posts/feed`
- `POST /api/v1/posts`
- `POST /api/v1/posts/:postId/reactions`
- `DELETE /api/v1/posts/:postId/reactions`
- `GET /api/v1/posts/:postId/comments`
- `POST /api/v1/posts/:postId/comments`
- `POST /api/v1/posts/:postId/report`
- `POST /api/v1/posts/:postId/poll/votes` with `{ "optionId": "..." }`
- `GET /api/v1/communities`
- `GET /api/v1/communities/:communityId`
- `POST /api/v1/communities/:communityId/join`
- `POST /api/v1/communities/:communityId/leave`

## Storage endpoints

- `POST /api/v1/uploads` (authenticated multipart form: `file`, optional `category`, optional `visibility`; backend streams the upload to R2)
- `POST /api/v1/uploads/presign`
- `POST /api/v1/uploads/complete`
- `DELETE /api/v1/uploads/:mediaId`

The web client uses the multipart endpoint (15 MB maximum; JPEG, PNG, WebP, MP3, MP4, or PDF) so R2 credentials and storage access remain on the backend; the browser does not upload directly to R2. Set `STORAGE_PROVIDER=cloudflare_r2` and provide `CF_ACCOUNT_ID`, `CF_ACCESS_KEY`, `CF_SECRET_KEY`, `CF_R2_BUCKET`, `CF_R2_REGION`, and `CF_R2_ENDPOINT` in the backend environment. Set `CF_R2_PUBLIC_URL` to the bucket's public URL or custom-domain base URL only when public media links are needed. The older `R2_*` variable names remain supported as fallbacks. Private assets are stored without a public URL, and the upload response includes the persisted media asset.

## Messaging endpoints

- `GET /api/v1/messaging/conversations`
- `POST /api/v1/messaging/conversations`
- `GET /api/v1/messaging/conversations/:conversationId`
- `GET /api/v1/messaging/conversations/:conversationId/messages`
- `POST /api/v1/messaging/conversations/:conversationId/messages`
- `PATCH /api/v1/messaging/conversations/:conversationId/read`
- `GET /api/v1/notifications`
- `GET /api/v1/notifications/unread-count`
- `PATCH /api/v1/notifications/:notificationId/read`
- `PATCH /api/v1/notifications/read-all`

## Groups and opportunities

- `GET /api/v1/groups`
- `GET /api/v1/groups/:groupId`
- `GET /api/v1/groups/:groupId/members`
- `POST /api/v1/groups`
- `POST /api/v1/groups/:groupId/join`
- `POST /api/v1/groups/:groupId/leave`
- `PATCH /api/v1/groups/:groupId`
- `DELETE /api/v1/groups/:groupId`
- `GET /api/v1/opportunities`
- `GET /api/v1/opportunities/:opportunityId`
- `GET /api/v1/opportunities/:opportunityId/applications/me`
- `POST /api/v1/opportunities/:opportunityId/applications` with optional `{ "coverLetter": "..." }`
- `DELETE /api/v1/opportunities/:opportunityId/applications/me` (withdraw a pending application)
- `GET /api/v1/opportunities/:opportunityId/applications` (organizer only)
- `PATCH /api/v1/opportunities/:opportunityId/applications/:applicationId` with `{ "status": "Accepted" | "Rejected" }` (organizer only)
- `POST /api/v1/opportunities`
- `PATCH /api/v1/opportunities/:opportunityId`
- `DELETE /api/v1/opportunities/:opportunityId`

Group joining is immediate; group owners are added as members when they create a group. Opportunity applications are unique per applicant and opportunity. Applicants can withdraw pending applications and reapply; organizers can review pending applications.

Socket.IO uses the default namespace. Authenticate the handshake with an access token using either
`Authorization: Bearer <token>` or `{ auth: { token: '<token>' } }`. The server validates conversation
membership before joining a room or sending/read-receipt updates.

Client events:

- `join-room` — `{ conversationId }`
- `leave-room` — `{ conversationId }`
- `send-message` — `{ conversationId, type?, content }`
- `typing` / `stop-typing` — `{ conversationId }`
- `messages-delivered` — `{ conversationId, messageIds }`, sent after receiving `new-message`
- `mark-read` — `{ conversationId }`

Server events include `new-message`, `message-sent`, `messages-delivered`, `messages-read`,
`typing`, `presence-update`, and `notification:new`. Message delivery and read receipts are tracked
per recipient; a sender should use the receipt records included with message responses to render status.

## Health endpoint

- `GET /api/v1/health`

Swagger is available at `/docs`.
