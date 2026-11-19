// Pure unit tests for the portfolio-access helpers (BR-14 building blocks).
// clientFilterFor is intentionally NOT tested here: it queries the database,
// so it belongs in tests/integration/access.test.js.
import { describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import { AppError } from '../../src/utils/send.js';
import { canAccessClient, clientScope, toObjectId } from '../../src/utils/access.js';

const oid = () => new mongoose.Types.ObjectId();
const fakeUser = (role, id = oid()) => ({ _id: id, role });

describe('toObjectId', () => {
  it('accepts a 24-char hex string', () => {
    const id = oid().toString();
    const result = toObjectId(id);
    expect(result).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(result.toString()).toBe(id);
  });

  it('accepts an ObjectId instance', () => {
    const id = oid();
    expect(toObjectId(id).equals(id)).toBe(true);
  });

  it.each([
    ['too short', 'abc'],
    ['non-hex', 'zzzzzzzzzzzzzzzzzzzzzzzz'],
    ['null', null],
    ['undefined', undefined],
    ['object', {}]
  ])('rejects %s with an AppError 400', (_label, value) => {
    expect(() => toObjectId(value)).toThrow(AppError);
    try {
      toObjectId(value);
    } catch (err) {
      expect(err.statusCode).toBe(400);
      expect(err.message).toMatch(/Invalid identifier/);
    }
  });
});

describe('clientScope', () => {
  it('restricts an agent to created-by OR assigned-to', () => {
    const agent = fakeUser('agent');
    expect(clientScope(agent)).toEqual({
      $or: [{ createdBy: agent._id }, { assignedAgents: agent._id }]
    });
  });

  it.each(['manager', 'admin'])('%s gets an empty filter (all clients)', (role) => {
    expect(clientScope(fakeUser(role))).toEqual({});
  });
});

describe('canAccessClient', () => {
  const agentA = fakeUser('agent');
  const agentB = fakeUser('agent');

  it('agent who created the client → true', () => {
    expect(canAccessClient(agentA, { createdBy: agentA._id, assignedAgents: [] })).toBe(true);
  });

  it('agent assigned to the client → true (N-N relation)', () => {
    expect(canAccessClient(agentB, { createdBy: agentA._id, assignedAgents: [agentB._id] })).toBe(true);
  });

  it('agent with neither relation → false (BR-14 portfolio isolation)', () => {
    expect(canAccessClient(agentB, { createdBy: agentA._id, assignedAgents: [] })).toBe(false);
  });

  it('handles populated refs (objects, not raw ids)', () => {
    const populated = { createdBy: { _id: agentA._id }, assignedAgents: [{ _id: agentB._id }] };
    expect(canAccessClient(agentB, populated)).toBe(true);
  });

  it('handles a missing assignedAgents array', () => {
    expect(canAccessClient(agentB, { createdBy: agentA._id })).toBe(false);
  });

  it.each(['manager', 'admin'])('%s can access any client', (role) => {
    expect(canAccessClient(fakeUser(role), { createdBy: agentA._id, assignedAgents: [] })).toBe(true);
  });
});