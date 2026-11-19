const WORD_RUN = /^\w+$/;
const TLD = /^\w{2,3}$/;

// A label is word-character runs joined by single separators, e.g. "a-b" (never "a--b", "-a" or "a-").
const isLabel = (text, separator) => text.split(separator).every(run => WORD_RUN.test(run));

// Same accepted language as /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/ but linear time:
// that regex nests quantifiers and can backtrack catastrophically (ReDoS) on crafted input.
export function isValidEmail(value) {
  if (typeof value !== 'string') return false;

  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;

  if (!isLabel(local, /[.-]/)) return false;

  const labels = domain.split('.');
  const tld = labels.pop();
  return labels.length > 0 && TLD.test(tld) && labels.every(label => isLabel(label, '-'));
}

// Mongoose `validate` option; empty values are left to `required`, like the former `match` validator.
export const emailValidator = {
  validator: value => value === undefined || value === null || value === '' || isValidEmail(value),
  message: 'Please provide a valid email'
};
