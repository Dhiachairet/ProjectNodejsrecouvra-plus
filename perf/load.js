// Charge : 20 utilisateurs simultanés pendant 2 minutes. Objectif cahier des charges : p95 < 500 ms, erreurs < 1 %
import { setup as commonSetup, scenario } from './common.js';

export const options = {
  vus: 20,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:stats}': ['p(95)<500'],
    'http_req_duration{name:invoices_list}': ['p(95)<500'],
    'http_req_duration{name:invoices_search}': ['p(95)<500'],
    'http_req_duration{name:login}': ['p(95)<500'],
    'http_req_duration{name:payment}': ['p(95)<500']
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'max']
};

export const setup = commonSetup;
export default scenario;
