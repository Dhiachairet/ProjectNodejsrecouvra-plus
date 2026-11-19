import { AppError } from './send.js';

// Builds a Mongo sort object from ?sortBy=&order=, accepting only whitelisted fields.
// Anything else (operators like $where, __proto__, arrays/objects from sortBy[$ne]=x) is rejected with a 400.
export function buildSort({ sortBy, order }, allowedFields, defaultField, defaultOrder) {
  const field = sortBy ?? defaultField;
  const direction = order ?? defaultOrder;

  if (typeof field !== 'string' || !allowedFields.includes(field)) {
    throw new AppError(`Invalid sortBy. Allowed values: ${allowedFields.join(', ')}`, 400);
  }
  if (direction !== 'asc' && direction !== 'desc') {
    throw new AppError('Invalid order. Allowed values: asc, desc', 400);
  }

  return { [field]: direction === 'asc' ? 1 : -1 };
}

export const CLIENT_SORT_FIELDS = ['name', 'email', 'company', 'createdAt', 'updatedAt'];
export const INVOICE_SORT_FIELDS = ['invoiceNumber', 'amount', 'paidAmount', 'issueDate', 'dueDate', 'status', 'createdAt', 'updatedAt'];
export const ACTION_SORT_FIELDS = ['actionDate', 'actionType', 'status', 'nextActionDate', 'createdAt', 'updatedAt'];
