# ZARA Accounting Cloud Vault — Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Master Owner / Verified Admin Authority**: Only verified users (`request.auth.token.email_verified == true`) matching the bootstrapped owner email (`rh.faysal007@gmail.com`) or an explicit `/admins/{uid}` document may read or write ZARA Accounting vault collections (`/appSettings`, `/users`, `/bazarBuyers`, `/transactions`, `/customers`, `/invoices`, `/commissionEntries`, `/commissionPersons`, `/commissionMonths`, `/homeBazarEntries`, `/deletedRecords`).
2. **Ownership & Query Isolation**: Every document carries an immutable `ownerUid` strictly equal to `request.auth.uid` on creation. Every `allow list` check validates `resource.data.ownerUid == request.auth.uid` directly without `get()` or `exists()` calls to prevent O(n) read amplification.
3. **Path ID Hardening**: Single-document read/write/delete operations validate document IDs with `isValidId(id)` (`size() <= 128` and `matches('^[a-zA-Z0-9_\\-]+$')`).
4. **Strict Keys & No Ghost Fields**: Every entity validation helper enforces `data.keys().hasAll(...)` and `data.keys().hasOnly(...)` on create and strict type/size constraints on both create and update. Updates additionally restrict mutated keys via `affectedKeys().hasOnly(...)`.
5. **Temporal Integrity & Immutability**: Every write validates `createdAt == request.time` on create, `createdAt == existing().createdAt` and `updatedAt == request.time` on update, and `incoming().ownerUid == existing().ownerUid`.
6. **PII Isolation**: User records (containing usernames and passwordHashes) and customer records (containing phone/email/address) are strictly gated behind `isBootstrappedOwner() || isAdmin()` and `resource.data.ownerUid == request.auth.uid`. Blanket `isSignedIn()` reads are forbidden.
7. **Terminal State Protection**: Cancelled invoices (`existing().status == 'Cancelled'`) and Cancelled commission entries (`existing().invoiceStatus == 'Cancelled'`) reject mutations unless overridden by `isAdmin()`.
8. **Bounded Arrays**: Invoice `items` array is strictly capped at `.size() <= 50` and validates element types when non-empty.

## 2. The "Dirty Dozen" Adversarial Payloads
Each payload below MUST return `PERMISSION_DENIED`:
1. **Unauthenticated Write**: Create `/users/usr_1` when `request.auth == null`.
2. **Unverified Email Spoof**: Create `/users/usr_2` with email `rh.faysal007@gmail.com` where `email_verified: false`.
3. **Non-Owner Read PII**: Read `/customers/cust_1` as an unrelated verified user (`other@example.com`).
4. **Blanket List Without Ownership Filter**: Query `/transactions` as an unrelated verified user or without `ownerUid == request.auth.uid`.
5. **Identity Spoofing on Create**: Create `/transactions/tx_1` setting `ownerUid: "someone_else"` instead of `request.auth.uid`.
6. **Shadow / Ghost Field Injection**: Create `/users/usr_3` with an extra undeclared field `isSuperAdmin: true`.
7. **Path ID Poisoning**: Create `/customers/bad..id$poison` failing `^[a-zA-Z0-9_\\-]+$`.
8. **Temporal Forgery on Create**: Create `/homeBazarEntries/hb_1` passing a hardcoded past `createdAt` instead of `request.time`.
9. **Immortal Field Mutation**: Update `/transactions/tx_1` attempting to change `ownerUid` or `createdAt`.
10. **Value Poisoning on Update**: Update `/invoices/inv_1` setting `totalAmount: "99999"` (string instead of number) or oversized string `notes` (`> 2000` chars).
11. **Role Self-Escalation / Direct Admin Write**: Create `/admins/attacker_uid` by a non-admin user.
12. **Unbounded Array / Type Poisoning**: Create `/invoices/inv_2` with `items` containing 51 entries or a non-map element `[123]`.
