import { createUserWithToken } from './auth.js';
import { createClient, createInvoice, createCollectionAction } from './factories.js';

// One portfolio = an agent with a token, plus a client, an unpaid invoice and a planned action that belong to them.
export async function createPortfolio() {
  const { user: agent, token } = await createUserWithToken('agent');
  const client = await createClient(agent);
  const invoice = await createInvoice(client, agent);
  const action = await createCollectionAction(invoice, agent);
  return { agent, token, client, invoice, action };
}

// Two agents with separate portfolios, a manager and an admin.
export async function createScenario() {
  const [a, b, manager, admin] = await Promise.all([
    createPortfolio(),
    createPortfolio(),
    createUserWithToken('manager'),
    createUserWithToken('admin')
  ]);
  return { a, b, manager, admin };
}
