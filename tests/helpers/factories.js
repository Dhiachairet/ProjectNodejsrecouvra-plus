import { Client } from '../../src/models/Client.js';
import { Invoice } from '../../src/models/Invoice.js';
import { CollectionAction } from '../../src/models/CollectionAction.js';

const DAY = 24 * 60 * 60 * 1000;

let sequence = 0;

// Client created by `owner`. For the N-N relation pass { assignedAgents: [agent._id] }.
export function createClient(owner, overrides = {}) {
  sequence += 1;
  return Client.create({
    name: `Client ${sequence}`,
    email: `client${sequence}@example.com`,
    phone: '+216 20 000 000',
    company: `Company ${sequence}`,
    createdBy: owner._id,
    ...overrides
  });
}

// Unpaid invoice of 1000 due in 30 days. On save the model computes the status
// and recalculates the client's totals, exactly as through the API.
export function createInvoice(client, creator, overrides = {}) {
  sequence += 1;
  return Invoice.create({
    invoiceNumber: `TEST-${String(sequence).padStart(5, '0')}`,
    client: client._id,
    amount: 1000,
    dueDate: new Date(Date.now() + 30 * DAY),
    createdBy: creator._id,
    ...overrides
  });
}

// Planned collection action on `invoice`, performed by `performer`.
export function createCollectionAction(invoice, performer, overrides = {}) {
  return CollectionAction.create({
    invoice: invoice._id,
    client: invoice.client,
    actionType: 'phone_call',
    performedBy: performer._id,
    statusHistory: [{ to: 'planned', changedBy: performer._id, note: 'Action created' }],
    ...overrides
  });
}
