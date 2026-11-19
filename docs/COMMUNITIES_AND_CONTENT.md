# Communities and content module

This phase adds the social layer for .

## Included features

- Public and private communities
- Membership requests and approvals
- Community rule and member tracking
- Public and community-scoped posts
- Text, image, audio, video and announcement content support
- Post reactions, comments and replies
- Poll creation and voting
- Report submission for inappropriate content

## API overview

- `GET /api/v1/communities`
- `POST /api/v1/communities`
- `GET /api/v1/communities/:communityId`
- `POST /api/v1/communities/:communityId/join`
- `POST /api/v1/communities/:communityId/leave`
- `GET /api/v1/communities/:communityId/requests`
- `POST /api/v1/communities/:communityId/requests/:requestId/approve`
- `POST /api/v1/communities/:communityId/requests/:requestId/reject`
- `GET /api/v1/posts/feed`
- `POST /api/v1/posts`
- `GET /api/v1/posts/:postId`
- `PATCH /api/v1/posts/:postId`
- `DELETE /api/v1/posts/:postId`
- `POST /api/v1/posts/:postId/reactions`
- `DELETE /api/v1/posts/:postId/reactions`
- `GET /api/v1/posts/:postId/comments`
- `POST /api/v1/posts/:postId/comments`
- `PATCH /api/v1/comments/:commentId`
- `DELETE /api/v1/comments/:commentId`
- `POST /api/v1/posts/:postId/report`
