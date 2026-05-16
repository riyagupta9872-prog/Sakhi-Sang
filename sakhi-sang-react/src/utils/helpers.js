// ── Date helpers ──────────────────────────────────────────────────────────────
export function toLocalDateStr(date = new Date()) {
  const ist = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, '0');
  const d = String(ist.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function snapToSunday(dateStr) {
  const d = parseLocalDate(dateStr);
  const day = d.getDay();
  if (day === 0) return dateStr;
  d.setDate(d.getDate() - day);
  return toLocalDateStr(d);
}

export function formatDate(str) {
  if (!str) return '—';
  const d = parseLocalDate(str);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateShort(str) {
  if (!str) return '—';
  const d = parseLocalDate(str);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function isBirthdayThisWeek(dob) {
  if (!dob) return false;
  const today = new Date();
  const bday = new Date(dob);
  const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
  const diff = (thisYear - today) / 86400000;
  return diff >= -1 && diff <= 6;
}

export function tsToISO(ts) {
  if (!ts) return null;
  if (typeof ts === 'string') return ts;
  if (ts.toDate) return ts.toDate().toISOString();
  return null;
}

export function shiftDate(dateStr, days) {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return toLocalDateStr(d);
}

export function getFYYears() {
  const now = new Date();
  const thisYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const years = [];
  for (let i = 0; i < 4; i++) {
    const y = thisYear - i;
    years.push({
      label: `${y}-${String(y + 1).slice(2)}`,
      startDate: `${y}-04-01`,
      endDate: `${y + 1}-03-31`,
    });
  }
  return years;
}

// ── String helpers ────────────────────────────────────────────────────────────
export function toCamel(f) {
  const result = {};
  for (const [k, v] of Object.entries(f)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camel] = typeof v === 'string' ? v.trim() : v;
  }
  return result;
}

export function toSnake(d) {
  const result = {};
  for (const [k, v] of Object.entries(d)) {
    const snake = k.replace(/([A-Z])/g, '_$1').toLowerCase();
    result[snake] = v;
  }
  return result;
}

export function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── UI helpers ────────────────────────────────────────────────────────────────
export function statusBadge(status) {
  const map = {
    'Most Serious': 'badge-ms',
    'Serious': 'badge-serious',
    'Expected to be Serious': 'badge-expected',
    'New Devotee': 'badge-new',
    'Inactive': 'badge-inactive',
  };
  return map[status] || 'badge-default';
}

export function teamBadge(team) {
  return `badge-team`;
}

export function attTimeStyle(isoStr) {
  if (!isoStr) return '';
  const t = new Date(isoStr);
  const h = t.getHours();
  if (h < 8) return 'time-early';
  if (h < 10) return 'time-ontime';
  return 'time-late';
}

export function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function avatarInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
