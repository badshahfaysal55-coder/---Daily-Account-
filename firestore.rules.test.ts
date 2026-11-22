/**
 * Security Rules Verification Spec for ZARA Accounting Firestore Cloud Vault
 * Covers the "Dirty Dozen" adversarial payloads documented in security_spec.md.
 * Run against Firebase Rules Emulator when available.
 */
import fs from 'fs';
import path from 'path';

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  docId: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated write to users collection',
    collection: 'users',
    docId: 'usr_unauth_1',
    operation: 'create',
    auth: null,
    payload: { id: 'usr_unauth_1', username: 'hacker', role: 'admin' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified email spoofing bootstrapped owner',
    collection: 'users',
    docId: 'usr_spoof_1',
    operation: 'create',
    auth: { uid: 'uid_spoof', email: 'rh.faysal007@gmail.com', email_verified: false },
    payload: { ownerUid: 'uid_spoof', id: 'usr_spoof_1', username: 'spoof', role: 'staff' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Non-owner reading customer PII',
    collection: 'customers',
    docId: 'cust_1',
    operation: 'get',
    auth: { uid: 'uid_other', email: 'other@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Blanket list query by non-owner',
    collection: 'transactions',
    docId: '',
    operation: 'list',
    auth: { uid: 'uid_other', email: 'other@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Identity spoofing setting wrong ownerUid on create',
    collection: 'transactions',
    docId: 'tx_spoof_1',
    operation: 'create',
    auth: { uid: 'uid_owner', email: 'rh.faysal007@gmail.com', email_verified: true },
    payload: { ownerUid: 'someone_else', id: 'tx_spoof_1', amount: 100 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Ghost/shadow field injection (isSuperAdmin)',
    collection: 'users',
    docId: 'usr_shadow_1',
    operation: 'create',
    auth: { uid: 'uid_owner', email: 'rh.faysal007@gmail.com', email_verified: true },
    payload: { ownerUid: 'uid_owner', id: 'usr_shadow_1', isSuperAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Path ID poisoning with disallowed characters',
    collection: 'customers',
    docId: 'bad..id$poison',
    operation: 'create',
    auth: { uid: 'uid_owner', email: 'rh.faysal007@gmail.com', email_verified: true },
    payload: { ownerUid: 'uid_owner', id: 'bad..id$poison', name: 'Poison' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Temporal forgery using client timestamp instead of serverTimestamp',
    collection: 'homeBazarEntries',
    docId: 'hb_time_1',
    operation: 'create',
    auth: { uid: 'uid_owner', email: 'rh.faysal007@gmail.com', email_verified: true },
    payload: { ownerUid: 'uid_owner', id: 'hb_time_1', createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Immortal field mutation attempting to alter ownerUid or createdAt',
    collection: 'transactions',
    docId: 'tx_1',
    operation: 'update',
    auth: { uid: 'uid_owner', email: 'rh.faysal007@gmail.com', email_verified: true },
    payload: { ownerUid: 'new_owner_uid' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Value poisoning setting numeric totalAmount to string on update',
    collection: 'invoices',
    docId: 'inv_1',
    operation: 'update',
    auth: { uid: 'uid_owner', email: 'rh.faysal007@gmail.com', email_verified: true },
    payload: { totalAmount: '99999' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Privilege escalation writing directly to /admins by non-admin',
    collection: 'admins',
    docId: 'uid_attacker',
    operation: 'create',
    auth: { uid: 'uid_attacker', email: 'attacker@example.com', email_verified: true },
    payload: { uid: 'uid_attacker', email: 'attacker@example.com' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unbounded array / invalid element poisoning on invoice items',
    collection: 'invoices',
    docId: 'inv_arr_1',
    operation: 'create',
    auth: { uid: 'uid_owner', email: 'rh.faysal007@gmail.com', email_verified: true },
    payload: { ownerUid: 'uid_owner', id: 'inv_arr_1', items: Array(51).fill({ description: 'x' }) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 13,
    name: 'Regular user self-escalating role and permission booleans',
    collection: 'users',
    docId: 'uid_staff',
    operation: 'update',
    auth: { uid: 'uid_staff', email: 'staff@example.com', email_verified: true },
    payload: {
      role: 'admin',
      canDeleteCustomers: true,
      canDeleteCommissionPersons: true,
      canChangeProfilePhoto: true,
      canChangeCommissionPersonPhoto: true,
      canDelete: true,
      canAddTransactions: true,
      canApproveInvoices: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 14,
    name: 'Cross-workspace read on commissionPersons by unrelated verified user',
    collection: 'commissionPersons',
    docId: 'cp_other_1',
    operation: 'get',
    auth: { uid: 'uid_unrelated', email: 'unrelated@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 15,
    name: 'Cross-workspace list on homeBazarEntries by unrelated verified user',
    collection: 'homeBazarEntries',
    docId: '',
    operation: 'list',
    auth: { uid: 'uid_unrelated', email: 'unrelated@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
];

export function verifyRulesFileInvariants(): boolean {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rulesText = fs.readFileSync(rulesPath, 'utf8');
  const requiredAssertions = [
    "rules_version = '2';",
    'allow read, write: if false;',
    'request.auth.token.email_verified == true',
    'isBootstrappedOwner()',
    'isPrivilegedManager()',
    'isUserPrivilegeFieldAffected()',
    'hasWorkspaceUserScope(',
    'hasEntityWorkspaceScope(',
    'hasCommissionPersonScope(',
    'hasCommissionEntryScope(',
    "existing().role != 'owner' || isBootstrappedOwner()",
    "incoming().role != 'owner' || isBootstrappedOwner()",
    'canDeleteCustomers',
    'canDeleteCommissionPersons',
    'canChangeProfilePhoto',
    'canChangeCommissionPersonPhoto',
    'canDelete',
    'canAddTransactions',
    'canApproveInvoices',
    'isValidId(',
    'affectedKeys().hasOnly(',
    'request.time',
    "data['service'] is string",
  ];
  return requiredAssertions.every((needle) => rulesText.includes(needle));
}
