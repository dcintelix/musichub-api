# Authentication flow

The authentication flow follows the required secure pattern:

1. User registers with full name, username, email, password and optional phone.
2. Password is hashed with Argon2id.
3. User is created in PendingVerification state.
4. A verification token is generated and stored hashed.
5. Resend sends the verification email.
6. User confirms email with the token.
7. Account status changes to Active.
8. User logs in with email and password.
9. Access token and refresh token are issued.
10. Refresh tokens are rotated for future renewal.

This implementation supports the first phase milestone for registration to verification to login.
