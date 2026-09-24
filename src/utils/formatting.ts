/**
 * Formatting and validation helper functions
 */

export function formatCurrency(amount, symbol = '₹') {
  if (amount === undefined || amount === null || isNaN(amount)) return `${symbol}0.00`;
  const val = parseFloat(amount);
  return `${symbol}${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function validateEmail(email: string): boolean {
  if (!email) return true; // Optional field
  const trimmed = email.trim();
  if (!trimmed) return true;
  if (!trimmed.includes('@')) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(trimmed);
}

export function validatePhone(phone: string): boolean {
  if (!phone) return true; // Optional field
  const trimmed = phone.trim();
  if (!trimmed) return true;
  // Clean all non-digit characters to verify it contains exactly 10 digits
  const cleanPhone = trimmed.replace(/\D/g, '');
  return cleanPhone.length === 10;
}

export function validatePassword(password: string): boolean {
  if (!password) return false;
  // Strong password: min 8 characters, at least one uppercase, one lowercase, one digit, one symbol
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  return password.length >= 8 && hasUpper && hasLower && hasNumber && hasSymbol;
}

export function generateStrongPassword(length = 10): string {
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const all = uppers + lowers + digits + symbols;

  let pass = '';
  // Guarantee at least one character from each required category
  pass += uppers.charAt(Math.floor(Math.random() * uppers.length));
  pass += lowers.charAt(Math.floor(Math.random() * lowers.length));
  pass += digits.charAt(Math.floor(Math.random() * digits.length));
  pass += symbols.charAt(Math.floor(Math.random() * symbols.length));

  for (let i = 4; i < length; i++) {
    pass += all.charAt(Math.floor(Math.random() * all.length));
  }

  // Fisher-Yates shuffle to ensure random character ordering
  const arr = pass.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

export function validateGST(gst) {
  if (!gst) return true; // Optional field
  // Standard Indian GSTIN regex pattern (15 characters)
  const re = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return re.test(gst.toUpperCase().trim());
}

export function validatePAN(pan) {
  if (!pan) return true; // Optional field
  // Standard Indian PAN regex pattern (10 characters)
  const re = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return re.test(pan.toUpperCase().trim());
}
