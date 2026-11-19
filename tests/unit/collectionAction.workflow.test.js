// Pure unit tests for the collection action workflow: no database, no HTTP.
// Rule references: BR-15, BR-16, BR-17 (workflow part), BR-18.
import { describe, expect, it } from '@jest/globals';
import {
  ACTION_STATUSES,
  ACTION_TRANSITIONS,
  allowedTransitions,
  checkTransition
} from '../../src/workflows/collectionAction.workflow.js';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const FUTURE = new Date('2026-06-20T12:00:00.000Z');
const PAST = new Date('2026-06-10T12:00:00.000Z');

const transition = (overrides = {}) =>
  checkTransition({ from: 'planned', to: 'completed', role: 'agent', result: 'ok', now: NOW, ...overrides });

describe('workflow definition', () => {
  it('exposes exactly the four statuses', () => {
    expect(ACTION_STATUSES).toEqual(['planned', 'completed', 'failed', 'cancelled']);
  });

  it('defines the documented transition graph', () => {
    expect(ACTION_TRANSITIONS).toEqual({
      planned: ['completed', 'failed', 'cancelled'],
      failed: ['planned', 'cancelled'],
      completed: [],
      cancelled: []
    });
  });

  it('allowedTransitions returns [] for an unknown status', () => {
    expect(allowedTransitions('nonsense')).toEqual([]);
  });

  it('is frozen (cannot be mutated at runtime)', () => {
    expect(Object.isFrozen(ACTION_TRANSITIONS)).toBe(true);
  });
});

describe('BR-15 — allowed transitions', () => {
  it.each([
    ['planned', 'completed', { result: 'reached' }],
    ['planned', 'failed', { result: 'unreachable' }],
    ['planned', 'cancelled', { role: 'manager' }],
    ['failed', 'planned', { actionDate: FUTURE }],
    ['failed', 'cancelled', { role: 'admin' }]
  ])('%s → %s is allowed', (from, to, extra) => {
    expect(transition({ from, to, ...extra })).toBeNull();
  });
});

describe('BR-15 — forbidden transitions return 409', () => {
  it.each([
    ['completed', 'planned'],
    ['completed', 'cancelled'],
    ['cancelled', 'planned'],
    ['cancelled', 'completed'],
    ['planned', 'planned'],
    ['failed', 'completed'],
    ['failed', 'failed']
  ])('%s → %s is refused with 409', (from, to) => {
    const refusal = transition({ from, to, role: 'admin', result: 'x', actionDate: FUTURE });
    expect(refusal).not.toBeNull();
    expect(refusal.status).toBe(409);
    expect(refusal.message).toMatch(/not allowed/);
  });
});

describe('BR-16 — completing or failing requires a result', () => {
  it.each(['completed', 'failed'])('to=%s without result → 400', (to) => {
    const refusal = transition({ to, result: undefined });
    expect(refusal?.status).toBe(400);
    expect(refusal.message).toMatch(/result is required/);
  });

  it.each(['completed', 'failed'])('to=%s with an empty/blank result → 400', (to) => {
    expect(transition({ to, result: '   ' })?.status).toBe(400);
  });

  it('to=completed with a real result → allowed', () => {
    expect(transition({ to: 'completed', result: 'paid in full' })).toBeNull();
  });
});

describe('BR-17 — only manager/admin can cancel (workflow rule)', () => {
  it('agent cancelling → 403', () => {
    const refusal = transition({ to: 'cancelled', role: 'agent' });
    expect(refusal?.status).toBe(403);
    expect(refusal.message).toMatch(/manager or an admin/);
  });

  it.each(['manager', 'admin'])('%s cancelling → allowed', (role) => {
    expect(transition({ to: 'cancelled', role })).toBeNull();
  });
});

describe('BR-18 — rescheduling a failed action needs a future date', () => {
  it('failed → planned with a future date → allowed', () => {
    expect(transition({ from: 'failed', to: 'planned', actionDate: FUTURE })).toBeNull();
  });

  it('failed → planned with a past date → 400', () => {
    const refusal = transition({ from: 'failed', to: 'planned', actionDate: PAST });
    expect(refusal?.status).toBe(400);
    expect(refusal.message).toMatch(/future action date/);
  });

  it('failed → planned without a date → 400', () => {
    expect(transition({ from: 'failed', to: 'planned', actionDate: undefined })?.status).toBe(400);
  });
});

describe('checkTransition — decision order', () => {
  it('an illegal transition is reported before the missing result', () => {
    // completed → planned is forbidden AND has no result; the 409 must win.
    const refusal = transition({ from: 'completed', to: 'planned', result: undefined });
    expect(refusal.status).toBe(409);
  });

  it('a valid transition with every precondition met returns exactly null', () => {
    expect(transition({ to: 'completed', result: 'done' })).toBeNull();
  });
});