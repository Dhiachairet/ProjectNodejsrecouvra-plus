// Resets the database and fills it with a reproducible demo dataset (same seed → same data).
// Usage: npm run seed   (reads MONGODB_URI from .env)
import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { Client } from '../src/models/Client.js';
import { Invoice } from '../src/models/Invoice.js';
import { CollectionAction } from '../src/models/CollectionAction.js';
import { AuditLog } from '../src/models/AuditLog.js';

const CLIENT_COUNT = 150;
const INVOICE_COUNT = 2000;
const DEMO_PASSWORD = 'Password123!';
const DAY = 24 * 60 * 60 * 1000;

// mulberry32: small deterministic PRNG so every run produces the same dataset
let state = 20261116;
function random() {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (min, max) => min + random() * (max - min);
const round2 = (value) => Math.round(value * 100) / 100;

const FIRST_NAMES = ['Ahmed', 'Sami', 'Leila', 'Ines', 'Karim', 'Mariem', 'Youssef', 'Amira', 'Walid', 'Nour', 'Hichem', 'Salma', 'Omar', 'Rania', 'Bilel', 'Sarra'];
const LAST_NAMES = ['Ben Ali', 'Trabelsi', 'Gharbi', 'Jaziri', 'Mansour', 'Haddad', 'Bouazizi', 'Chaabane', 'Khelifi', 'Mejri', 'Saidi', 'Ayari', 'Hamdi', 'Ferchichi'];
const COMPANY_TYPES = ['SARL', 'SA', 'SUARL', 'Group', 'Services', 'Distribution', 'Industries', 'Consulting'];
const SECTORS = ['Atlas', 'Medina', 'Carthage', 'Sahel', 'Jasmin', 'Olivier', 'Phenix', 'Horizon', 'Delta', 'Etoile', 'Cap Bon', 'Zitouna'];
const CITIES = ['Tunis', 'Ariana', 'Sfax', 'Sousse', 'Nabeul', 'Bizerte', 'Monastir', 'Gabes', 'Kairouan', 'Ben Arous'];
const ACTION_TYPES = ['phone_call', 'email', 'meeting', 'reminder_letter', 'legal_notice', 'visit'];
const PAYMENT_METHODS = ['cash', 'bank_transfer', 'check', 'credit_card'];
const RESULTS = {
  completed: ['Reached client, promised to pay', 'Partial payment announced', 'Payment plan accepted', 'Reminder received and acknowledged'],
  failed: ['Client unreachable', 'Wrong phone number', 'Refused to pay', 'Missed the meeting']
};

function invoiceStatus({ amount, paidAmount, dueDate }, now) {
  if (paidAmount >= amount) return 'paid';
  if (paidAmount > 0) return 'partially_paid';
  if (dueDate < now) return 'overdue';
  return 'unpaid';
}

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Seeding ${mongoose.connection.name} on ${mongoose.connection.host}`);

  await Promise.all([User, Client, Invoice, CollectionAction, AuditLog].map(model => model.deleteMany({})));
  await Promise.all([User, Client, Invoice, CollectionAction, AuditLog].map(model => model.syncIndexes()));

  // Users: created one by one so the password hashing hook runs
  const accounts = [
    { email: 'admin@recouvra.tn', firstName: 'Amine', lastName: 'Admin', role: 'admin' },
    { email: 'manager@recouvra.tn', firstName: 'Mona', lastName: 'Manager', role: 'manager' },
    { email: 'agent1@recouvra.tn', firstName: 'Aziz', lastName: 'Agent', role: 'agent' },
    { email: 'agent2@recouvra.tn', firstName: 'Asma', lastName: 'Agent', role: 'agent' },
    { email: 'agent3@recouvra.tn', firstName: 'Adel', lastName: 'Agent', role: 'agent' }
  ];
  const users = [];
  for (const account of accounts) {
    users.push(await User.create({ ...account, password: DEMO_PASSWORD }));
  }
  const manager = users.find(u => u.role === 'manager');
  const agents = users.filter(u => u.role === 'agent');

  // Clients, each followed by 0 to 2 extra agents (N-N)
  const clientDocs = Array.from({ length: CLIENT_COUNT }, (_, i) => {
    const owner = random() < 0.85 ? pick(agents) : manager;
    const assigned = new Set([owner.role === 'agent' ? owner._id.toString() : pick(agents)._id.toString()]);
    if (random() < 0.3) assigned.add(pick(agents)._id.toString());
    const company = `${pick(SECTORS)} ${pick(COMPANY_TYPES)}`;
    return {
      name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      email: `contact${i + 1}@${company.toLowerCase().replace(/[^a-z]/g, '')}.tn`,
      phone: `+216 ${Math.floor(between(20, 99))} ${Math.floor(between(100, 999))} ${Math.floor(between(100, 999))}`,
      company,
      address: { city: pick(CITIES), country: 'Tunisia' },
      createdBy: owner._id,
      assignedAgents: [...assigned]
    };
  });
  const clients = await Client.insertMany(clientDocs);

  // Invoices over the last 12 months, with a realistic mix of paid / partial / open / overdue
  const now = new Date();
  const invoiceDocs = Array.from({ length: INVOICE_COUNT }, (_, i) => {
    const client = pick(clients);
    const issueDate = new Date(now.getTime() - between(0, 365) * DAY);
    const dueDate = new Date(issueDate.getTime() + pick([15, 30, 45, 60]) * DAY);
    const amount = round2(between(150, 25000));
    const collector = client.assignedAgents.length ? pick(client.assignedAgents) : client.createdBy;

    const roll = random();
    const payments = [];
    if (roll < 0.4) {
      const first = round2(amount * between(0.3, 0.7));
      payments.push({ amount: first }, { amount: round2(amount - first) });
    } else if (roll < 0.65) {
      payments.push({ amount: round2(amount * between(0.1, 0.8)) });
    }
    const datedPayments = payments.map(payment => ({
      ...payment,
      paymentMethod: pick(PAYMENT_METHODS),
      paymentDate: new Date(Math.min(now.getTime(), issueDate.getTime() + between(1, 90) * DAY)),
      reference: `PAY-${i + 1}`,
      receivedBy: collector
    }));
    const paidAmount = round2(datedPayments.reduce((sum, p) => sum + p.amount, 0));

    const invoice = {
      invoiceNumber: `FAC-${issueDate.getFullYear()}-${String(i + 1).padStart(5, '0')}`,
      client: client._id,
      amount,
      paidAmount,
      issueDate,
      dueDate,
      description: `${pick(SECTORS)} services`,
      payments: datedPayments,
      createdBy: client.createdBy
    };

    if (paidAmount === 0 && random() < 0.04) {
      return { ...invoice, status: 'cancelled', cancelledAt: issueDate, cancelledReason: 'Issued by mistake', cancelledBy: manager._id };
    }
    return { ...invoice, status: invoiceStatus(invoice, now) };
  });
  const invoices = await Invoice.insertMany(invoiceDocs);

  // insertMany skips the post-save hook, so client totals are computed once here
  const totals = await Invoice.aggregate([
    { $match: { status: { $ne: 'cancelled' } } },
    { $group: {
      _id: '$client',
      totalInvoices: { $sum: 1 },
      totalPaid: { $sum: '$paidAmount' },
      totalUnpaid: { $sum: { $subtract: ['$amount', '$paidAmount'] } }
    }}
  ]);
  await Client.bulkWrite(totals.map(({ _id, ...fields }) => ({
    updateOne: { filter: { _id }, update: { $set: fields } }
  })));

  // Collection actions on unpaid / overdue invoices, following the workflow rules
  const clientById = new Map(clients.map(c => [c._id.toString(), c]));
  const openInvoices = invoices.filter(inv => ['unpaid', 'partially_paid', 'overdue'].includes(inv.status));
  const actionDocs = [];
  for (const invoice of openInvoices) {
    if (random() > 0.6) continue;
    const client = clientById.get(invoice.client.toString());
    const count = 1 + Math.floor(random() * 3);
    for (let k = 0; k < count; k++) {
      const performer = client.assignedAgents.length ? pick(client.assignedAgents) : client.createdBy;
      const actionDate = new Date(now.getTime() + between(-90, 20) * DAY);
      const createdStep = { to: 'planned', changedBy: performer, changedAt: new Date(actionDate.getTime() - 2 * DAY), note: 'Action created' };

      let status = 'planned';
      let result;
      const history = [createdStep];
      if (actionDate < now) {
        const roll = random();
        status = roll < 0.6 ? 'completed' : roll < 0.85 ? 'failed' : roll < 0.95 ? 'cancelled' : 'planned';
        if (status === 'completed' || status === 'failed') result = pick(RESULTS[status]);
        if (status !== 'planned') {
          history.push({
            from: 'planned',
            to: status,
            changedBy: status === 'cancelled' ? manager._id : performer,
            changedAt: actionDate,
            note: result
          });
        }
      }

      actionDocs.push({
        invoice: invoice._id,
        client: client._id,
        actionType: invoice.status === 'overdue' && random() < 0.2 ? 'legal_notice' : pick(ACTION_TYPES),
        actionDate,
        status,
        result,
        statusHistory: history,
        notes: `Follow-up on invoice ${invoice.invoiceNumber}`,
        performedBy: performer,
        contactPerson: client.name,
        contactEmail: client.email,
        contactPhone: client.phone
      });
    }
  }
  await CollectionAction.insertMany(actionDocs);

  console.log(`Created ${users.length} users, ${clients.length} clients, ${invoices.length} invoices, ${actionDocs.length} collection actions.`);
  console.log(`\nDemo accounts (password: ${DEMO_PASSWORD})`);
  for (const user of users) {
    console.log(`  ${user.role.padEnd(8)} ${user.email}`);
  }
}

seed()
  .catch(error => {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
