// Status workflow of a collection action.
//
//   planned ──► completed            (terminal, requires a result)
//      │  ──► failed ──► planned     (retry, requires a future date)
//      │         └────► cancelled
//      └────► cancelled              (terminal, manager/admin only)

export const ACTION_STATUSES = ['planned', 'completed', 'failed', 'cancelled'];

export const ACTION_TRANSITIONS = Object.freeze({
  planned: ['completed', 'failed', 'cancelled'],
  failed: ['planned', 'cancelled'],
  completed: [],
  cancelled: []
});

// Map lookup: an unknown status (even "constructor" or "__proto__") can never resolve to an inherited property.
const TRANSITIONS_BY_STATUS = new Map(Object.entries(ACTION_TRANSITIONS));

export function allowedTransitions(status) {
  return TRANSITIONS_BY_STATUS.get(status) ?? [];
}

// Returns null when the transition is allowed, otherwise { status, message } describing the refusal.
export function checkTransition({ from, to, role, result, actionDate, now = new Date() }) {
  if (!allowedTransitions(from).includes(to)) {
    return { status: 409, message: `Transition from ${from} to ${to} is not allowed` };
  }

  if ((to === 'completed' || to === 'failed') && !result?.trim()) {
    return { status: 400, message: `A result is required to mark an action as ${to}` };
  }

  if (to === 'cancelled' && role === 'agent') {
    return { status: 403, message: 'Only a manager or an admin can cancel a collection action' };
  }

  if (to === 'planned' && !(actionDate && new Date(actionDate) > now)) {
    return { status: 400, message: 'Rescheduling an action requires a future action date' };
  }

  return null;
}
