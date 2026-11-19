import { sendJson, sendError } from '../utils/send.js';
import { validateStatsQuery } from '../utils/validation.js';
import { buildScope, computeStats, computeSummary } from '../services/stats.service.js';


export async function getStats(req, res, next) {
  try {
    const { error, value } = validateStatsQuery.validate(req.query);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const scope = await buildScope(req.user, value);
    const stats = await computeStats(scope, new Date());

    sendJson(res, 200, {
      success: true,
      filters: scope.filters,
      stats
    });
  } catch (error) {
    next(error);
  }
}


export async function getSummaryStats(req, res, next) {
  try {
    const summary = await computeSummary(new Date());

    sendJson(res, 200, {
      success: true,
      summary
    });
  } catch (error) {
    next(error);
  }
}
