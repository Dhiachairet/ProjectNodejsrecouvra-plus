import mongoose from 'mongoose';
import { Client } from '../models/Client.js';
import { AppError } from './send.js';

const OBJECT_ID = /^[a-f\d]{24}$/i;

const idOf = (ref) => (ref?._id ?? ref)?.toString();

export function toObjectId(value) {
  if (!OBJECT_ID.test(String(value))) {
    throw new AppError('Invalid identifier', 400);
  }
  return new mongoose.Types.ObjectId(String(value));
}

// Agents reach the clients they created or were assigned to; managers and admins reach every client.
export function clientScope(user) {
  if (user.role !== 'agent') return {};
  return { $or: [{ createdBy: user._id }, { assignedAgents: user._id }] };
}

export function canAccessClient(user, client) {
  if (user.role !== 'agent') return true;
  const userId = idOf(user);
  return idOf(client.createdBy) === userId ||
    (client.assignedAgents ?? []).some(agent => idOf(agent) === userId);
}

// Same rule from a client id (or a populated client). An agent gets false for a client that does not exist.
export async function canAccessClientId(user, clientRef) {
  if (user.role !== 'agent') return true;
  const client = await Client.findById(idOf(clientRef));
  return Boolean(client) && canAccessClient(user, client);
}

export function clientIdsForAgent(agentId) {
  return Client.find({ $or: [{ createdBy: agentId }, { assignedAgents: agentId }] }).distinct('_id');
}

// Value for a `client` filter on invoices/actions, combining the requested client with the user's scope.
// Returns undefined when nothing restricts the query. Always ObjectIds, so it is safe in aggregations.
export async function clientFilterFor(user, requestedClient) {
  const requested = requestedClient ? toObjectId(requestedClient) : null;
  if (user.role !== 'agent') return requested ?? undefined;

  const ids = await clientIdsForAgent(user._id);
  if (!requested) return { $in: ids };
  return ids.some(id => id.equals(requested)) ? requested : { $in: [] };
}
