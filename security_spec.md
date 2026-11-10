# Security Specification — Prime One Cloud Sync

## 1. Data Invariants
1. **Owner-Isolated Profile & PII**: `/users/{userId}` stores private account PII (`email`, `displayName`, `photoURL`). Read (`get`) and write access are strictly limited to `request.auth.uid == userId`; collection `list` queries on `/users` are permanently denied.
2. **Master Gate Parent Integrity**: Sub-collections (`/users/{userId}/tracks/{trackId}`, `/users/{userId}/playlists/{playlistId}`, `/users/{userId}/preferences/{prefId}`) cannot exist without a verified parent `/users/{userId}` document whose `uid` equals `request.auth.uid`.
3. **Immutable Ownership & Temporal Integrity**: `ownerId` (or `uid` on `/users/{userId}`), `id`, and `createdAt` cannot be modified after creation. All `createdAt` writes must equal `request.time`; all `updatedAt` writes must equal `request.time`.
4. **Verified Auth Only**: All create, update, and delete operations require `request.auth != null && request.auth.token.email_verified == true`.
5. **Action-Based Partial Updates & Strict Key Whitelists**: Every write invokes `isValid[Entity](incoming())`, checks strict string/numeric/list size bounds to block Denial-of-Wallet storage abuse, and updates are partitioned into explicit actions with `affectedKeys().hasOnly(...)`.
6. **Zero-Trust Query Enforcement**: Every `allow list` on subcollections explicitly enforces `request.auth.uid == userId && resource.data.ownerId == request.auth.uid` without `get()` or `exists()` lookups.

## 2. The "Dirty Dozen" Attack Payloads
1. **Unauthenticated Track Read/Write**: Signed-out client reads or writes `/users/u1/tracks/t1` -> **PERMISSION_DENIED**.
2. **Unverified Email Token**: Authenticated user with `email_verified: false` attempts to create `/users/u1` or update a track -> **PERMISSION_DENIED**.
3. **Cross-Tenant Profile PII Leak**: User `u2` calls `get` on `/users/u1` -> **PERMISSION_DENIED**.
4. **Collection Scraping List on `/users`**: Authenticated user queries `list` on `/users` -> **PERMISSION_DENIED**.
5. **Identity Spoofing on Track Create**: User `u2` creates `/users/u2/tracks/t1` with `ownerId: "u1"` -> **PERMISSION_DENIED**.
6. **Orphaned Subcollection Write**: User `u1` creates `/users/u1/tracks/t1` before `/users/u1` exists -> **PERMISSION_DENIED**.
7. **Shadow Ghost Field Injection**: User `u1` updates `/users/u1/tracks/t1` adding `{ isAdmin: true, title: "New" }` -> **PERMISSION_DENIED**.
8. **Immutable Owner / Timestamp Tampering**: User `u1` updates `/users/u1/tracks/t1` trying to mutate `createdAt` or `ownerId` -> **PERMISSION_DENIED**.
9. **Spoofed Client Timestamp**: User `u1` creates track with past `createdAt` (`Timestamp.fromMillis(1000)`) instead of `serverTimestamp()` -> **PERMISSION_DENIED**.
10. **ID Path Poisoning**: User `u1` creates `/users/u1/tracks/bad..id$foo` or >128 char document ID -> **PERMISSION_DENIED**.
11. **Oversized Array / String Value Poisoning**: User `u1` writes playlist with `trackIds.length > 500` or `track.coverUrl.length > 250000` -> **PERMISSION_DENIED**.
12. **Unconstrained List Query**: User `u1` lists `/users/u1/tracks` without matching `where('ownerId', '==', 'u1')` -> **PERMISSION_DENIED**.
