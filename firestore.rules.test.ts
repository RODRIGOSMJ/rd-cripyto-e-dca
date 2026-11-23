/**
 * Security Rules Verification Spec — Dirty Dozen Payloads
 * Documents the 12 adversarial payloads that must return PERMISSION_DENIED
 * against firestore.rules.
 */

export interface AdversarialCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: AdversarialCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Read',
    operation: 'get',
    path: '/users/userA',
    auth: null,
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 2,
    name: 'Unverified Email Create',
    operation: 'create',
    path: '/users/userA',
    auth: { uid: 'userA', email_verified: false },
    payload: { ownerId: 'userA', currency: 'USDT' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 3,
    name: 'Cross-User Goal Read',
    operation: 'get',
    path: '/users/userA/goals/POL',
    auth: { uid: 'userB', email_verified: true },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 4,
    name: 'Identity Spoofing on Goal Create',
    operation: 'create',
    path: '/users/userA/goals/POL',
    auth: { uid: 'userA', email_verified: true },
    payload: { id: 'POL', ownerId: 'userB', symbol: 'POL' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 5,
    name: 'Owner Hijack on Settings Update',
    operation: 'update',
    path: '/users/userA',
    auth: { uid: 'userA', email_verified: true },
    payload: { ownerId: 'userB' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 6,
    name: 'Shadow Field Injection (isAdmin)',
    operation: 'create',
    path: '/users/userA',
    auth: { uid: 'userA', email_verified: true },
    payload: { ownerId: 'userA', isAdmin: true },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 7,
    name: 'Orphaned Goal Without Parent UserSettings',
    operation: 'create',
    path: '/users/userNoParent/goals/POL',
    auth: { uid: 'userNoParent', email_verified: true },
    payload: { id: 'POL', ownerId: 'userNoParent', symbol: 'POL' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 8,
    name: 'ID Poisoning with Invalid Characters',
    operation: 'create',
    path: '/users/userA/goals/bad!@#id',
    auth: { uid: 'userA', email_verified: true },
    payload: { id: 'bad!@#id', ownerId: 'userA' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 9,
    name: 'Client Timestamp Forgery',
    operation: 'create',
    path: '/users/userA',
    auth: { uid: 'userA', email_verified: true },
    payload: { ownerId: 'userA', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 10,
    name: 'Immutable createdAt Mutation on Update',
    operation: 'update',
    path: '/users/userA/goals/POL',
    auth: { uid: 'userA', email_verified: true },
    payload: { createdAt: '2025-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 11,
    name: 'Unbounded Array (>120 monthlyRecords)',
    operation: 'create',
    path: '/users/userA/goals/POL',
    auth: { uid: 'userA', email_verified: true },
    payload: { id: 'POL', ownerId: 'userA', monthlyRecords: new Array(125).fill({}) },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 12,
    name: 'Value Poisoning on Allowed Key (negative retirementGoalUSD)',
    operation: 'update',
    path: '/users/userA',
    auth: { uid: 'userA', email_verified: true },
    payload: { retirementGoalUSD: -5000 },
    expected: 'PERMISSION_DENIED'
  }
];
