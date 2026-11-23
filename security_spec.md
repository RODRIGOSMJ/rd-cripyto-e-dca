# Security Specification — RG Crypto DCA & Aposentadoria

## 1. Data Invariants
1. Every document in `/users/{userId}` can only be read, created, updated, or deleted by the verified authenticated owner (`request.auth.uid == userId` and `request.auth.token.email_verified == true`), and `ownerId` must equal `userId` and remain immutable.
2. Every document in `/users/{userId}/goals/{goalId}` belongs strictly to the parent `/users/{userId}` document (Master Gate check via `exists`/`get` or `existsAfter`/`getAfter` on create), can only be accessed by its verified owner, and its `id`, `ownerId`, and `createdAt` fields are immutable after creation.
3. No unauthenticated access or cross-user reads/writes are allowed anywhere in the database (default-deny catch-all at the top of `firestore.rules`).
4. Every string field enforces strict `.size()` bounds; IDs match `^[a-zA-Z0-9_\-]+$`; `monthlyRecords` is strictly bounded (`1 <= size() <= 120`) and validated for map structure.
5. All `createdAt` and `updatedAt` timestamps must match server `request.time`.
6. No extra ("shadow") fields are accepted on create or update (`keys().hasOnly(...)` and `affectedKeys().hasOnly(...)`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Read/Write**: Read `/users/userA` with `auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: Create `/users/userA` with `email_verified: false` -> `PERMISSION_DENIED`.
3. **Cross-User Read (PII/Data Isolation)**: UserB attempts `get` on `/users/userA` or `/users/userA/goals/POL` -> `PERMISSION_DENIED`.
4. **Identity Spoofing on Create**: UserA attempts to create `/users/userA/goals/POL` with `ownerId: "userB"` -> `PERMISSION_DENIED`.
5. **Owner Hijack on Update**: UserA attempts to update `/users/userA` changing `ownerId` to `"userB"` -> `PERMISSION_DENIED`.
6. **Shadow Field Injection**: UserA creates `/users/userA` with an extra field `isAdmin: true` -> `PERMISSION_DENIED`.
7. **Orphaned Subcollection Write (Master Gate Bypass)**: UserA creates `/users/userA/goals/POL` when parent `/users/userA` does not exist -> `PERMISSION_DENIED`.
8. **ID Poisoning**: UserA creates `/users/userA/goals/<200-char-invalid-id!@#>` -> `PERMISSION_DENIED`.
9. **Client Timestamp Forgery**: UserA creates `/users/userA` with a forged past/future `createdAt` != `request.time` -> `PERMISSION_DENIED`.
10. **Immutable Field Mutation (`createdAt` / `id`)**: UserA updates `/users/userA/goals/POL` modifying `createdAt` -> `PERMISSION_DENIED`.
11. **Unbounded Array / Denial-of-Wallet**: UserA writes a `CryptoGoal` with `monthlyRecords` containing 121+ elements or empty `[]` -> `PERMISSION_DENIED`.
12. **Value Poisoning on Allowed Key**: UserA updates `retirementGoalUSD` with a string `"999999"` or negative number `-500`, or updates `currency` to `"EUR"` -> `PERMISSION_DENIED`.
