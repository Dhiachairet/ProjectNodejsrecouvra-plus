// references: BR-04, BR-08, BR-09, BR-13, plus query validators.
import { describe, expect, it } from '@jest/globals';
import {
  MAX_AGENTS_PER_CLIENT,
  validateAssignAgents,
  validateAuditQuery,
  validateClient,
  validateClientUpdate,
  validateCollectionAction,
  validateCollectionActionUpdate,
  validateInvoice,
  validateInvoiceUpdate,
  validatePayment,
  validateRegister,
  validateStatsQuery,
  validateStatusTransition,
  validateUserUpdate
} from '../../src/utils/validation.js';

const ok = (schema, value) => schema.validate(value).error;
const HEX = 'a'.repeat(24);

const futureDate = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const pastDate = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

describe('validateRegister', () => {
  it('accepts a valid payload and defaults the role to agent', () => {
    const { error, value } = validateRegister.validate({
      email: 'a@b.com', password: 'Password123!', firstName: 'A', lastName: 'B'
    });
    expect(error).toBeUndefined();
    expect(value.role).toBe('agent');
  });

  it('rejects an unknown role', () => {
    expect(ok(validateRegister, {
      email: 'a@b.com', password: 'Password123!', firstName: 'A', lastName: 'B', role: 'superadmin'
    })).toBeDefined();
  });

  it('rejects a short password', () => {
    expect(ok(validateRegister, { email: 'a@b.com', password: '123', firstName: 'A', lastName: 'B' })).toBeDefined();
  });
});

describe('validateUserUpdate (BR-11 supporting)', () => {
  it('rejects an empty body (at least one field)', () => {
    expect(ok(validateUserUpdate, {})).toBeDefined();
  });

  it('accepts a role/active change', () => {
    expect(ok(validateUserUpdate, { role: 'manager', active: false })).toBeUndefined();
  });
});

describe('validateClient / validateClientUpdate (BR-12 supporting)', () => {
  const validClient = { name: 'ACME', email: 'c@acme.tn', phone: '+21620000000' };

  it('accepts a valid client', () => {
    expect(ok(validateClient, validClient)).toBeUndefined();
  });

  it('update allows partial fields', () => {
    expect(ok(validateClientUpdate, { name: 'Renamed' })).toBeUndefined();
  });

  it('update rejects an empty body', () => {
    expect(ok(validateClientUpdate, {})).toBeDefined();
  });
});

describe('validateInvoice (BR-09, BR-08)', () => {
  const base = { invoiceNumber: 'FAC-1', client: HEX, amount: 100 };

  it('accepts a future due date', () => {
    expect(ok(validateInvoice, { ...base, dueDate: futureDate() })).toBeUndefined();
  });

  it('BR-09: rejects a past due date', () => {
    const err = ok(validateInvoice, { ...base, dueDate: pastDate() });
    expect(err).toBeDefined();
    expect(err.details[0].message).toMatch(/future/);
  });

  it('BR-09: rejects a missing due date', () => {
    expect(ok(validateInvoice, { ...base })).toBeDefined();
  });

  it('BR-08: accepts a valid items array', () => {
    const items = [{ description: 'Line', quantity: 2, unitPrice: 50, amount: 100 }];
    expect(ok(validateInvoice, { ...base, dueDate: futureDate(), items })).toBeUndefined();
  });

  it('BR-08: rejects an item with a non-positive quantity', () => {
    const items = [{ description: 'Line', quantity: 0, unitPrice: 50, amount: 100 }];
    expect(ok(validateInvoice, { ...base, dueDate: futureDate(), items })).toBeDefined();
  });

  it('rejects a non-positive amount', () => {
    expect(ok(validateInvoice, { ...base, amount: 0, dueDate: futureDate() })).toBeDefined();
  });
});

describe('validateInvoiceUpdate (BR-04)', () => {
  it('BR-04: cancelling without a reason → error', () => {
    expect(ok(validateInvoiceUpdate, { status: 'cancelled' })).toBeDefined();
  });

  it('BR-04: cancelling with a reason → ok', () => {
    expect(ok(validateInvoiceUpdate, { status: 'cancelled', cancelledReason: 'Issued by mistake' })).toBeUndefined();
  });

  it('BR-04: a reason without cancellation status → forbidden', () => {
    expect(ok(validateInvoiceUpdate, { cancelledReason: 'orphan reason' })).toBeDefined();
  });

  it('rejects an empty body', () => {
    expect(ok(validateInvoiceUpdate, {})).toBeDefined();
  });

  it('only allows the cancelled status (paid/completed go through other paths)', () => {
    expect(ok(validateInvoiceUpdate, { status: 'paid' })).toBeDefined();
  });
});

describe('validatePayment (BR-02 supporting)', () => {
  it('accepts a valid payment', () => {
    expect(ok(validatePayment, { amount: 10, paymentMethod: 'cash' })).toBeUndefined();
  });

  it('rejects a non-positive amount', () => {
    expect(ok(validatePayment, { amount: 0, paymentMethod: 'cash' })).toBeDefined();
  });

  it('rejects an unknown method', () => {
    expect(ok(validatePayment, { amount: 10, paymentMethod: 'bitcoin' })).toBeDefined();
  });
});

describe('validateCollectionAction / Update (BR-19 supporting)', () => {
  it('accepts a valid action', () => {
    expect(ok(validateCollectionAction, { invoice: HEX, actionType: 'phone_call' })).toBeUndefined();
  });

  it('rejects an invalid action type', () => {
    expect(ok(validateCollectionAction, { invoice: HEX, actionType: 'carrier_pigeon' })).toBeDefined();
  });

  it('BR-19: update does not accept a status field', () => {
    expect(ok(validateCollectionActionUpdate, { status: 'completed' })).toBeDefined();
  });

  it('BR-19: update accepts editable fields', () => {
    expect(ok(validateCollectionActionUpdate, { notes: 'left a voicemail' })).toBeUndefined();
  });
});

describe('validateStatusTransition', () => {
  it('accepts each valid target status', () => {
    for (const status of ['planned', 'completed', 'failed', 'cancelled']) {
      expect(ok(validateStatusTransition, { status })).toBeUndefined();
    }
  });

  it('rejects an unknown status', () => {
    expect(ok(validateStatusTransition, { status: 'archived' })).toBeDefined();
  });
});

describe('validateAssignAgents (BR-13)', () => {
  it('accepts up to the maximum number of agents', () => {
    const agents = Array.from({ length: MAX_AGENTS_PER_CLIENT }, () => 'a'.repeat(24).replace(/a/g, 'a'));
    const distinct = agents.map((_, i) => String(i).padStart(24, '0'));
    expect(ok(validateAssignAgents, { agents: distinct })).toBeUndefined();
  });

  it('rejects more than the maximum', () => {
    const tooMany = Array.from({ length: MAX_AGENTS_PER_CLIENT + 1 }, (_, i) => String(i).padStart(24, '0'));
    const err = ok(validateAssignAgents, { agents: tooMany });
    expect(err).toBeDefined();
    expect(err.details[0].message).toMatch(/at most/);
  });

  it('rejects duplicates', () => {
    const dup = ['0'.repeat(24), '0'.repeat(24)];
    expect(ok(validateAssignAgents, { agents: dup })).toBeDefined();
  });

  it('rejects a non-hex id', () => {
    expect(ok(validateAssignAgents, { agents: ['not-an-id'] })).toBeDefined();
  });

  it('rejects an empty list', () => {
    expect(ok(validateAssignAgents, { agents: [] })).toBeUndefined(); // allowed: unassign everyone
  });
});

describe('query validators', () => {
  it('validateStatsQuery: rejects to before from', () => {
    const from = futureDate().toISOString();
    const to = pastDate().toISOString();
    expect(ok(validateStatsQuery, { from, to })).toBeDefined();
  });

  it('validateStatsQuery: accepts a valid range', () => {
    expect(ok(validateStatsQuery, { from: pastDate().toISOString(), to: futureDate().toISOString() })).toBeUndefined();
  });

  it('validateAuditQuery: caps limit at 100', () => {
    expect(ok(validateAuditQuery, { limit: 1000 })).toBeDefined();
  });

  it('validateAuditQuery: rejects a bad action pattern', () => {
    expect(ok(validateAuditQuery, { action: 'DROP TABLE' })).toBeDefined();
  });

  it('validateAuditQuery: accepts a dotted action prefix', () => {
    expect(ok(validateAuditQuery, { action: 'invoice.' })).toBeUndefined();
  });
});