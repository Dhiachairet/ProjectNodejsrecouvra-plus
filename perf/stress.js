// Stress : paliers croissants pour trouver le point de rupture (p95 qui explose ou erreurs qui montent)
import { setup as commonSetup, scenario } from './common.js';

export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '1m', target: 200 },
    { duration: '1m', target: 0 }
  ],
  // Seuils informatifs : ils indiquent à partir de quand l'objectif n'est plus tenu, sans arrêter le test
  thresholds: { http_req_duration: ['p(95)<500'], http_req_failed: ['rate<0.01'] },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'max']
};

export const setup = commonSetup;
export default scenario;
