import React from 'react';

export function calcProfileCompletion(d) {
  if (!d) return 0;
  const checks = [
    d.name, d.mobile, d.dob, d.address, d.email,
    d.education, d.profession, d.reads_books, d.hears_katha, d.hobbies,
    d.reference_by, d.facilitator, d.calling_by,
    d.family_favourable,
    (d.family_members != null && d.family_members !== '') ? 'ok' : '',
    d.plays_instrument, d.wants_kirtan,
  ];
  const filled = checks.filter(v => v !== undefined && v !== null && v !== '').length;
  return Math.round((filled / checks.length) * 100);
}

export default function ProfileGauge({ pct, size = 64 }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const arc = (pct / 100) * circ;
  const color = pct >= 80 ? '#16a34a' : pct >= 50 ? '#b8860b' : '#d97706';
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" className="profile-gauge">
      <circle cx="30" cy="30" r={r} stroke="#fde68a" strokeWidth="5" fill="none" />
      <circle
        cx="30" cy="30" r={r}
        stroke={color} strokeWidth="5" fill="none"
        strokeLinecap="round"
        strokeDasharray={`${arc} ${circ}`}
        transform="rotate(-90 30 30)"
        style={{ transition: 'stroke-dasharray .6s ease' }}
      />
      <text x="30" y="30" textAnchor="middle" dominantBaseline="central"
        fontSize="14" fontWeight="700" fill="#1a1a1a">{pct}%</text>
    </svg>
  );
}
