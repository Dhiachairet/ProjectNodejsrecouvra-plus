// Génère la collection Postman/Newman du contrat API (§6.3 interopérabilité).
// Usage : node api-tests/build-collection.mjs  -> api-tests/recouvra-contract.postman_collection.json
import fs from 'fs';

const json = { key: 'Content-Type', value: 'application/json' };
const bearer = (v) => ({ key: 'Authorization', value: `Bearer {{${v}}}` });

function req(name, method, path, { token = 'token', body, tests = [], pre = [] } = {}) {
  const header = [];
  if (token) header.push(bearer(token));
  if (body) header.push(json);
  const event = [{ listen: 'test', script: { type: 'text/javascript', exec: tests } }];
  if (pre.length) event.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: pre } });
  const [p, q] = path.split('?');
  return {
    name,
    event,
    request: {
      method,
      header,
      url: {
        raw: `{{baseUrl}}${path}`,
        host: ['{{baseUrl}}'],
        path: p.split('/').filter(Boolean),
        ...(q && { query: q.split('&').map(kv => { const [key, value] = kv.split('='); return { key, value }; }) })
      },
      ...(body && { body: { mode: 'raw', raw: JSON.stringify(body, null, 2) } })
    }
  };
}

const status = (code) => `pm.test("status ${code}", () => pm.response.to.have.status(${code}));`;

const valid = [
  req('CT-P-API-01 login admin (stocke le jeton)', 'POST', '/auth/login', {
    token: null,
    body: { email: 'admin@recouvra.tn', password: 'Password123!' },
    tests: [status(200),
      'const b = pm.response.json();',
      'pm.test("shape: token + user", () => { pm.expect(b.token).to.be.a("string"); pm.expect(b.user.role).to.eql("admin"); pm.expect(b.user).to.not.have.property("password"); });',
      'pm.environment.set("token", b.token);']
  }),
  req('CT-P-API-02 login agent1 (stocke le jeton)', 'POST', '/auth/login', {
    token: null,
    body: { email: 'agent1@recouvra.tn', password: 'Password123!' },
    tests: [status(200), 'pm.environment.set("agentToken", pm.response.json().token);']
  }),
  req('CT-P-API-03 profil courant', 'GET', '/auth/me', {
    tests: [status(200), 'pm.test("shape: user.email", () => pm.expect(pm.response.json().user.email).to.eql("admin@recouvra.tn"));']
  }),
  req('CT-P-API-04 liste des clients paginée', 'GET', '/clients?page=1&limit=5', {
    tests: [status(200),
      'const b = pm.response.json();',
      'pm.test("shape: clients[] + total/page/pages", () => { pm.expect(b.clients).to.be.an("array").with.lengthOf(5); pm.expect(b.total).to.be.a("number"); pm.expect(b.page).to.eql(1); pm.expect(b.pages).to.be.a("number"); });']
  }),
  req('CT-P-API-05 factures impayées page 1', 'GET', '/invoices?status=unpaid&page=1&limit=20', {
    tests: [status(200),
      'const b = pm.response.json();',
      'pm.test("shape: invoices[] + summary", () => { pm.expect(b.invoices).to.be.an("array"); pm.expect(b.invoices.length).to.be.at.most(20); pm.expect(b.summary).to.have.property("totalAmount"); });',
      'pm.test("filtre respecté: toutes unpaid", () => b.invoices.forEach(i => pm.expect(i.status).to.eql("unpaid")));']
  }),
  req('CT-P-API-06 recherche par numéro', 'GET', '/invoices?search=FAC-2026-0001', {
    tests: [status(200),
      'const b = pm.response.json();',
      'pm.test("au moins un résultat", () => pm.expect(b.total).to.be.above(0));',
      'pm.test("tous les numéros commencent par la recherche", () => b.invoices.forEach(i => pm.expect(i.invoiceNumber.startsWith("FAC-2026-0001")).to.be.true));']
  }),
  req('CT-P-API-07 actions de recouvrement', 'GET', '/collections?limit=5', {
    tests: [status(200), 'pm.test("shape: actions[]", () => pm.expect(pm.response.json().actions).to.be.an("array"));']
  }),
  req('CT-P-API-08 tableau de bord', 'GET', '/stats', {
    tests: [status(200),
      'const s = pm.response.json().stats;',
      'pm.test("shape: overview + invoicesByStatus + monthlyStats", () => { pm.expect(s.overview).to.have.property("recoveryRate"); pm.expect(s.invoicesByStatus).to.be.an("object"); pm.expect(s.monthlyStats).to.be.an("array"); });']
  }),
  req('CT-P-API-09 créer un client', 'POST', '/clients', {
    pre: ['pm.environment.set("stamp", Date.now());'],
    body: { name: 'Newman {{stamp}}', email: 'newman{{stamp}}@api.tn', phone: '71000000', company: 'API SARL' },
    tests: [status(201), 'const c = pm.response.json().client;', 'pm.test("shape: client._id", () => pm.expect(c._id).to.match(/^[0-9a-f]{24}$/));', 'pm.environment.set("clientId", c._id);']
  }),
  req('CT-P-API-10 créer une facture de 1000', 'POST', '/invoices', {
    pre: ['const d = new Date(); d.setDate(d.getDate() + 30); pm.environment.set("dueDate", d.toISOString().slice(0, 10));'],
    body: { invoiceNumber: 'NEWMAN-{{stamp}}', client: '{{clientId}}', amount: 1000, dueDate: '{{dueDate}}' },
    tests: [status(201), 'const i = pm.response.json().invoice;', 'pm.test("statut calculé unpaid", () => pm.expect(i.status).to.eql("unpaid"));', 'pm.environment.set("invoiceId", i._id);']
  }),
  req('CT-P-API-11 paiement égal au solde (limite valide)', 'POST', '/invoices/{{invoiceId}}/payments', {
    body: { amount: 1000, paymentMethod: 'bank_transfer' },
    tests: ['pm.test("status 200/201", () => pm.expect(pm.response.code).to.be.oneOf([200, 201]));',
      'pm.test("facture payée", () => pm.expect(pm.response.json().invoice.status).to.eql("paid"));']
  }),
  req('CT-P-API-12 limit=100 (limite) renvoie 100 factures', 'GET', '/invoices?limit=100', {
    tests: [status(200), 'pm.test("100 résultats", () => pm.expect(pm.response.json().invoices.length).to.eql(100));']
  })
];

const refused = [
  req('CT-E-API-01 sans jeton -> 401', 'GET', '/invoices', { token: null, tests: [status(401)] }),
  req('CT-E-API-02 jeton invalide -> 401', 'GET', '/invoices', { token: 'badToken', tests: [status(401)] }),
  req('CT-E-API-03 mauvais mot de passe -> 401', 'POST', '/auth/login', {
    token: null, body: { email: 'admin@recouvra.tn', password: 'faux' },
    tests: [status(401), 'pm.test("pas de jeton", () => pm.expect(pm.response.json()).to.not.have.property("token"));']
  }),
  req('CT-E-API-04 agent sur /audit -> 403 (BR-20)', 'GET', '/audit', { token: 'agentToken', tests: [status(403)] }),
  req('CT-E-API-05 agent supprime un client -> 403', 'DELETE', '/clients/{{clientId}}', { token: 'agentToken', tests: [status(403)] }),
  req('CT-E-API-06 paiement sur facture payée -> 400 (BR-03)', 'POST', '/invoices/{{invoiceId}}/payments', {
    body: { amount: 0.01, paymentMethod: 'cash' }, tests: [status(400)]
  }),
  req('CT-E-API-07 facture échéance passée -> 400 (BR-09)', 'POST', '/invoices', {
    body: { invoiceNumber: 'NEWMAN-PAST-{{stamp}}', client: '{{clientId}}', amount: 10, dueDate: '2020-01-01' }, tests: [status(400)]
  }),
  req('CT-E-API-08 numéro de facture en double -> 400 (BR-01)', 'POST', '/invoices', {
    body: { invoiceNumber: 'NEWMAN-{{stamp}}', client: '{{clientId}}', amount: 10, dueDate: '{{dueDate}}' }, tests: [status(400)]
  }),
  req('CT-E-API-09 client avec factures non supprimable -> 400 (BR-06)', 'DELETE', '/clients/{{clientId}}', { tests: [status(400)] }),
  req('CT-E-API-10 identifiant mal formé -> 4xx, jamais 500', 'GET', '/clients/abc', {
    tests: ['pm.test("4xx", () => pm.expect(pm.response.code).to.be.within(400, 499));']
  }),
  req('CT-E-API-11 limit=101 plafonné à 100 (valeur limite)', 'GET', '/invoices?limit=101', {
    tests: [status(200), 'pm.test("au plus 100 résultats", () => pm.expect(pm.response.json().invoices.length).to.be.at.most(100));']
  })
];

const collection = {
  info: {
    name: 'Recouvra+ contrat API (§6.3)',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    description: 'Interopérabilité : un client externe qui suit swagger.yaml obtient les codes HTTP et la structure attendus, y compris pour les refus.'
  },
  event: [{ listen: 'test', script: { type: 'text/javascript', exec: ['pm.test("jamais d\'erreur 500", () => pm.expect(pm.response.code).to.be.below(500));'] } }],
  item: [
    { name: 'Cas valides (CT-P)', item: valid },
    { name: 'Refus attendus (CT-E)', item: refused }
  ]
};

fs.writeFileSync(new URL('./recouvra-contract.postman_collection.json', import.meta.url), JSON.stringify(collection, null, 2));
console.log(`collection écrite : ${valid.length + refused.length} requêtes`);
