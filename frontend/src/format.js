export const CURRENCY = 'TND';
const LOCALE = 'en-GB';

const moneyFormat = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium' });
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'short', timeStyle: 'short' });
const monthFormat = new Intl.DateTimeFormat(LOCALE, { month: 'short', year: 'numeric' });

export const money = (value) => `${moneyFormat.format(value ?? 0)} ${CURRENCY}`;
export const date = (value) => (value ? dateFormat.format(new Date(value)) : '—');
export const dateTime = (value) => (value ? dateTimeFormat.format(new Date(value)) : '—');
export const month = (yearMonth) => monthFormat.format(new Date(`${yearMonth}-01`));
export const fullName = (user) => (user ? `${user.firstName} ${user.lastName}` : '—');

// Value for <input type="date"> from an ISO date
export const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

export const INVOICE_STATUS = {
  unpaid: 'Unpaid',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled'
};

export const ACTION_STATUS = {
  planned: 'Planned',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled'
};

export const TRANSITION_LABEL = {
  completed: 'Complete',
  failed: 'Mark failed',
  cancelled: 'Cancel',
  planned: 'Reschedule'
};

export const ACTION_TYPE = {
  phone_call: 'Phone call',
  email: 'Email',
  meeting: 'Meeting',
  reminder_letter: 'Reminder letter',
  legal_notice: 'Formal notice',
  visit: 'On-site visit'
};

export const PAYMENT_METHOD = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  check: 'Check',
  credit_card: 'Credit card',
  other: 'Other'
};

export const ROLE = {
  admin: 'Administrator',
  manager: 'Manager',
  agent: 'Agent'
};

export const AUDIT_ACTION = {
  'auth.login': 'Login',
  'auth.login_failed': 'Failed login',
  'auth.register': 'Account created',
  'user.update': 'User updated',
  'user.delete': 'User deleted',
  'client.create': 'Client created',
  'client.update': 'Client updated',
  'client.delete': 'Client deleted',
  'client.assign_agents': 'Agents assigned',
  'invoice.create': 'Invoice created',
  'invoice.update': 'Invoice updated',
  'invoice.cancel': 'Invoice cancelled',
  'invoice.delete': 'Invoice deleted',
  'invoice.payment': 'Payment recorded',
  'action.create': 'Action created',
  'action.update': 'Action updated',
  'action.status_change': 'Status changed',
  'action.delete': 'Action deleted'
};
