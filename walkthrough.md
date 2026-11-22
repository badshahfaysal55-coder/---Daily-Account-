# Security Summary

A full security review and hardening pass was completed on **ZF Accounting** across Firestore security rules, backend Express API endpoints, session handling, and file upload paths while preserving all existing verified records.

## Key Hardening Changes
- **Global Default Deny All**: `firestore.rules` enforces `match /{document=**} { allow read, write: if false; }` at the top level so any unmatched path or omitted operation is denied by default.
- **Role & Permission Non-Escalation**:
  - In `firestore.rules`, only the bootstrapped owner (`rh.faysal007@gmail.com`) can create or update `/admins/{uid}` documents or create, promote, modify, or delete `'owner'` accounts.
  - User account writes and updates under `/users/{userId}` require `isBootstrappedOwner() || isAdmin()` and guard `role`, `status`, and every permission boolean (`canDeleteCustomers`, `canDeleteCommissionPersons`, `canChangeProfilePhoto`, `canChangeCommissionPersonPhoto`, `canDelete`, `canAddTransactions`, `canApproveInvoices`, and all commission/bazar permission flags) via `isUserPrivilegeFieldAffected()`. Regular users cannot escalate their own role or permissions.
  - On the Express backend, `POST /api/sync/recover-if-empty` rejects non-owner privilege escalation attempts in `snapshot.users` with HTTP `403`, restricts `db.users`, `db.globalSettings`, `bazarBuyers`, `commissionEntries`, `commissionPersons`, `commissionMonths`, and tombstones strictly to the owner, and scopes non-owner recovery to their own workspace and granted permissions.
- **Workspace & Ownership Scoping**:
  - `transactions`, `customers`, `invoices`, `commissionPersons`, `commissionEntries`, and `homeBazarEntries` are scoped on both `get` and `list` by `ownerUid` or explicit workspace membership (`workspaceUserId`, `userId`, `linkedUserId`, `agentId`, `createdByUserId`).
  - All `allow list` rules evaluate directly on `resource.data` without `get()` or `exists()` calls.
  - Numeric financial fields carry non-negative bounds (`>= 0`), and all entity schemas enforce strict key allowlists, string length limits, and server timestamp integrity.
- **Authentication, Route Authorization & Path Confinement**:
  - Removed substring token spoofing and unauthenticated fallback in `authMiddleware`, and updated `/api/auth/session` to return HTTP `401` whenever an invalid or spoofed Bearer token is presented.
  - Enforced `canAddTransactions === false` on `PUT /api/transactions/:id`, `viewer` guards across mutating customer, invoice, home-bazar, buyer, commission, and commission-person endpoints, and `isCommissionOnly` guards on mutating `/api/home-bazar*` routes.
  - Added canonical path confinement (`resolvePhotoFilePathSafe` / `unlinkPhotoFileSafe`) for all photo uploads and deletions.
- **Dependency Notes**:
  - A dependency audit identified 6 existing package advisories (`@grpc/grpc-js`, `glob`, `minimatch`, and `xlsx@0.18.5`). Because the spreadsheet package has no drop-in patched version on the current line, only trusted internal workbooks should be imported.
  - Because security rules evolve alongside new features, please review `firestore.rules` carefully before sharing the app broadly.

---

## PoC Verification

1. **Firestore Rules ESLint & Static Invariants**:
   - Command: `npx eslint firestore.rules`
   - Outcome: Exited with code `0` (zero errors or warnings).
   - Command: `npx tsx -e "import { verifyRulesFileInvariants, DIRTY_DOZEN_CASES } from './firestore.rules.test.ts'; console.log('invariants:', verifyRulesFileInvariants(), 'cases:', DIRTY_DOZEN_CASES.length);"`
   - Outcome: `invariants: true cases: 15` (all 15 adversarial test cases and required rule guards verified, including regular-user role/permission self-escalation and cross-workspace access checks).

2. **Firestore Rules Deployment**:
   - Deployed updated `firestore.rules` to Firebase via `DeployRules`.
   - Outcome: Succeeded (`{}`).

3. **TypeScript & Vite Build Verification**:
   - Co-executed `compile_applet` and `lint_applet` (`tsc --noEmit`).
   - Outcome: Vite production build succeeded and `tsc --noEmit` completed with zero errors.

4. **Live Server API & Token Rejection Verification (`http://localhost:3000`)**:
   - `GET /api/users` (no token) -> `401`
   - `GET /api/users` (spoofed substring token `Bearer evil_usr_owner_faisal`) -> `401`
   - `GET /api/transactions` (spoofed substring token `Bearer evil_rh.faysal007`) -> `401`
   - `GET /api/auth/session` (spoofed substring token `Bearer fake_usr_owner_faisal`) -> `401`
   - `GET /api/auth/session` (spoofed `Bearer token_auto_fake`) -> `401`
   - `POST /api/sync/recover-if-empty` (unauthenticated) -> `401`
   - `PUT /api/users/usr_owner_faisal` (unauthenticated) -> `401`
   - `PUT /api/transactions/tx_1` (unauthenticated) -> `401`
   - `GET /api/auth/session` (preview boot without prior token) -> `200` (`usr_owner_faisal`, `role: owner`)
   - `GET /api/transactions` (with valid owner session token) -> `200` (`count: 12`)

5. **Verified Data Preservation Check (`/data/zara_database.json`)**:
   - Confirmed all existing records remain intact: `users: 3`, `transactions: 12`, `customers: 2`, `invoices: 1` (`inv-1794792609803-959`, `status: 'partial'`, `balanceDue: 50`, `totalAmount: 450`), `commissionPersons: 1`, `commissionEntries: 19`, `homeBazarEntries: 7`.
