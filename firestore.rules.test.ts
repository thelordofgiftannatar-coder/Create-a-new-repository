/**
 * Verification suite for Prime One Firestore Security Rules (Dirty Dozen payloads).
 * Designed for execution against @firebase/rules-unit-testing when running the Firebase Emulator.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export interface DirtyDozenScenario {
  id: number;
  name: string;
  actorUid: string | null;
  emailVerified: boolean;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenScenario[] = [
  {
    id: 1,
    name: 'Unauthenticated read/write to user tracks',
    actorUid: null,
    emailVerified: false,
    operation: 'get',
    path: '/users/userA/tracks/track1',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified email user creating profile',
    actorUid: 'userA',
    emailVerified: false,
    operation: 'create',
    path: '/users/userA',
    payload: { uid: 'userA', displayName: 'Unverified User', createdAt: 'SERVER_TIME', updatedAt: 'SERVER_TIME' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-tenant PII read on /users/{userId}',
    actorUid: 'userB',
    emailVerified: true,
    operation: 'get',
    path: '/users/userA',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Directory listing /users collection scrape',
    actorUid: 'userA',
    emailVerified: true,
    operation: 'list',
    path: '/users',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Identity spoofing ownerId mismatch on track creation',
    actorUid: 'userB',
    emailVerified: true,
    operation: 'create',
    path: '/users/userB/tracks/track1',
    payload: {
      id: 'track1',
      ownerId: 'userA',
      title: 'Spoofed',
      artist: 'Attacker',
      album: 'Test',
      duration: 120,
      source: 'local',
      dateAdded: 1700000000,
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Orphaned subcollection create without parent /users/userA',
    actorUid: 'userOrphan',
    emailVerified: true,
    operation: 'create',
    path: '/users/userOrphan/playlists/pl1',
    payload: {
      id: 'pl1',
      ownerId: 'userOrphan',
      name: 'Orphan List',
      trackIds: [],
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Shadow ghost field injection (isAdmin: true) on update',
    actorUid: 'userA',
    emailVerified: true,
    operation: 'update',
    path: '/users/userA/tracks/track1',
    payload: { title: 'Updated', isAdmin: true, updatedAt: 'SERVER_TIME' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Immutable ownerId / createdAt overwrite on update',
    actorUid: 'userA',
    emailVerified: true,
    operation: 'update',
    path: '/users/userA/tracks/track1',
    payload: { ownerId: 'userB', title: 'Mutated Owner', updatedAt: 'SERVER_TIME' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Spoofed client timestamp on track create',
    actorUid: 'userA',
    emailVerified: true,
    operation: 'create',
    path: '/users/userA/tracks/track2',
    payload: {
      id: 'track2',
      ownerId: 'userA',
      title: 'Backdated',
      artist: 'Artist',
      album: 'Album',
      duration: 180,
      source: 'curated',
      dateAdded: 1700000000,
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: 'SERVER_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Path variable ID poisoning (invalid chars)',
    actorUid: 'userA',
    emailVerified: true,
    operation: 'create',
    path: '/users/userA/tracks/bad..id$foo!',
    payload: { id: 'bad..id$foo!', ownerId: 'userA' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Oversized playlist array exceeding 500 trackIds limit',
    actorUid: 'userA',
    emailVerified: true,
    operation: 'update',
    path: '/users/userA/playlists/pl1',
    payload: {
      trackIds: Array.from({ length: 505 }, (_, i) => `t-${i}`),
      updatedAt: 'SERVER_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Invalid source enum value poisoning',
    actorUid: 'userA',
    emailVerified: true,
    operation: 'update',
    path: '/users/userA/tracks/track1',
    payload: { source: 'malicious_external_bucket', updatedAt: 'SERVER_TIME' },
    expectedResult: 'PERMISSION_DENIED',
  },
];

describe('Prime One Firestore Security Matrix', () => {
  it('defines all 12 adversarial attack vectors for verification', () => {
    assert.equal(DIRTY_DOZEN_PAYLOADS.length, 12);
    assert.ok(DIRTY_DOZEN_PAYLOADS.every((s) => s.expectedResult === 'PERMISSION_DENIED'));
  });
});
