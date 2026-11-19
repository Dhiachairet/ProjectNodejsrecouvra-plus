export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

const positiveInt = (value) => {
  const number = parseInt(value, 10);
  return Number.isInteger(number) && number > 0 ? number : null;
};

// Turns ?page & ?limit into safe values: limit between 1 and 100 (default 10), page at least 1.
// Without the cap, ?limit=100000 returns the whole collection in a single response.
export function pagination(query) {
  const page = positiveInt(query.page) ?? 1;
  const limit = Math.min(positiveInt(query.limit) ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  return { page, limit, skip: (page - 1) * limit };
}
