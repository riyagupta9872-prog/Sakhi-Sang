import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, writeBatch, serverTimestamp, increment,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './config';
import { toLocalDateStr, snapToSunday, shiftDate, chunkArray, tsToISO } from '../utils/helpers';

// ── DevoteeCache ──────────────────────────────────────────────────────────────
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 90000;

async function getCache() {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL) return _cache;
  const snap = await getDocs(query(collection(db, 'devotees'), where('isActive', '!=', false)));
  _cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  _cacheAt = Date.now();
  return _cache;
}

export function bustCache() { _cache = null; }

// ── Conversion helpers ─────────────────────────────────────────────────────────
function toSnake(d) {
  return {
    id: d.id,
    name: d.name || '',
    mobile: d.mobile || '',
    mobile_alt: d.mobileAlt || d.mobile_alt || '',
    email: d.email || '',
    dob: d.dob || '',
    address: d.address || '',
    team_name: d.teamName || d.team_name || '',
    devotee_status: d.devoteeStatus || d.devotee_status || '',
    reference_by: d.referenceBy || d.reference_by || '',
    reference_id: d.referenceId || d.reference_id || '',
    facilitator: d.facilitator || '',
    calling_by: d.callingBy || d.calling_by || '',
    education: d.education || '',
    profession: d.profession || '',
    chanting_rounds: d.chantingRounds ?? d.chanting_rounds ?? 0,
    kanthi: d.kanthi ?? 0,
    tilak: d.tilak ?? 0,
    gopi_dress: d.gopiDress ?? d.gopi_dress ?? 0,
    reads_books: d.readsBooks || d.reads_books || '',
    hears_katha: d.hearsKatha || d.hears_katha || '',
    plays_instrument: d.playsInstrument || d.plays_instrument || '',
    instrument_name: d.instrumentName || d.instrument_name || '',
    wants_kirtan: d.wantsKirtan || d.wants_kirtan || '',
    family_members: d.familyMembers ?? d.family_members ?? null,
    family_participants: d.familyParticipants ?? d.family_participants ?? null,
    family_favourable: d.familyFavourable || d.family_favourable || '',
    hobbies: d.hobbies || '',
    remarks: d.remarks || '',
    joining_date: d.joiningDate || d.joining_date || '',
    prior_sessions: d.priorSessions ?? d.prior_sessions ?? 0,
    lifetime_attendance: d.lifetimeAttendance ?? d.lifetime_attendance ?? 0,
    inactivity_flag: d.inactivityFlag ?? d.inactivity_flag ?? false,
    calling_mode: d.callingMode || d.calling_mode || '',
    is_active: d.isActive ?? true,
    created_at: tsToISO(d.createdAt || d.created_at),
    updated_at: tsToISO(d.updatedAt || d.updated_at),
  };
}

function toCamel(f) {
  return {
    name: (f.name || '').trim(),
    mobile: (f.mobile || '').replace(/\D/g, '').slice(0, 10),
    mobileAlt: (f.mobile_alt || f.mobileAlt || '').replace(/\D/g, '').slice(0, 10),
    email: (f.email || '').trim(),
    dob: f.dob || '',
    address: (f.address || '').trim(),
    teamName: f.team_name || f.teamName || '',
    devoteeStatus: f.devotee_status || f.devoteeStatus || '',
    referenceBy: (f.reference_by || f.referenceBy || '').trim(),
    referenceId: f.reference_id || f.referenceId || '',
    facilitator: (f.facilitator || '').trim(),
    callingBy: (f.calling_by || f.callingBy || '').trim(),
    education: (f.education || '').trim(),
    profession: (f.profession || '').trim(),
    chantingRounds: parseInt(f.chanting_rounds || f.chantingRounds || 0, 10),
    kanthi: f.kanthi ? 1 : 0,
    tilak: f.tilak ? 1 : 0,
    gopiDress: f.gopi_dress ?? f.gopiDress ?? 0,
    readsBooks: f.reads_books || f.readsBooks || '',
    hearsKatha: f.hears_katha || f.hearsKatha || '',
    playsInstrument: f.plays_instrument || f.playsInstrument || '',
    instrumentName: (f.instrument_name || f.instrumentName || '').trim(),
    wantsKirtan: f.wants_kirtan || f.wantsKirtan || '',
    familyMembers: f.family_members != null ? parseInt(f.family_members, 10) : null,
    familyParticipants: f.family_participants != null ? parseInt(f.family_participants, 10) : null,
    familyFavourable: f.family_favourable || f.familyFavourable || '',
    hobbies: (f.hobbies || '').trim(),
    remarks: (f.remarks || '').trim(),
    joiningDate: f.joining_date || f.joiningDate || toLocalDateStr(),
    priorSessions: parseInt(f.prior_sessions || f.priorSessions || 0, 10),
  };
}

// ── Devotee operations ────────────────────────────────────────────────────────
export const DB = {

  async getDevotees(filters = {}) {
    let list = await getCache();
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(d =>
        (d.name || '').toLowerCase().includes(q) ||
        (d.mobile || '').includes(q)
      );
    }
    if (filters.team) list = list.filter(d => d.teamName === filters.team || d.team_name === filters.team);
    if (filters.callingBy) list = list.filter(d => d.callingBy === filters.callingBy || d.calling_by === filters.callingBy);
    if (filters.status) {
      if (filters.status === 'inactive') list = list.filter(d => d.isActive === false);
      else list = list.filter(d => d.devoteeStatus === filters.status || d.devotee_status === filters.status);
    }
    return list.map(toSnake);
  },

  async getDevotee(id) {
    const snap = await getDoc(doc(db, 'devotees', id));
    if (!snap.exists()) return null;
    return toSnake({ id: snap.id, ...snap.data() });
  },

  async getCallingPersons() {
    const list = await getCache();
    const names = [...new Set(list.map(d => d.callingBy || d.calling_by).filter(Boolean))];
    return names.sort();
  },

  async createDevotee(formData) {
    const data = toCamel(formData);
    const list = await getCache();
    const dup = list.find(d =>
      (d.name || '').toLowerCase() === data.name.toLowerCase() &&
      (d.mobile || '') === data.mobile
    );
    if (dup) throw Object.assign(new Error('Duplicate devotee'), { code: 409 });
    const ref = await addDoc(collection(db, 'devotees'), {
      ...data,
      isActive: true,
      lifetimeAttendance: data.priorSessions || 0,
      inactivityFlag: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedAtClient: new Date().toISOString(),
    });
    bustCache();
    return { id: ref.id, ...data };
  },

  async forceCreateDevotee(formData) {
    const data = toCamel(formData);
    const ref = await addDoc(collection(db, 'devotees'), {
      ...data,
      isActive: true,
      lifetimeAttendance: data.priorSessions || 0,
      inactivityFlag: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedAtClient: new Date().toISOString(),
    });
    bustCache();
    return { id: ref.id, ...data };
  },

  async updateDevotee(id, formData, changedBy = '') {
    const data = toCamel(formData);
    const old = await this.getDevotee(id);
    const tracked = ['name','mobile','chantingRounds','kanthi','gopiDress','teamName','devoteeStatus','facilitator','referenceBy','callingBy','remarks'];
    const changes = [];
    for (const f of tracked) {
      const snakeKey = f.replace(/([A-Z])/g, '_$1').toLowerCase();
      const oldVal = old[snakeKey] ?? old[f] ?? '';
      const newVal = data[f] ?? '';
      if (String(oldVal) !== String(newVal)) {
        changes.push({ field: snakeKey, oldValue: String(oldVal), newValue: String(newVal) });
      }
    }
    await updateDoc(doc(db, 'devotees', id), {
      ...data,
      updatedAt: serverTimestamp(),
      updatedAtClient: new Date().toISOString(),
    });
    if (changes.length) {
      const batch = writeBatch(db);
      changes.forEach(c => {
        batch.set(doc(collection(db, 'profileChanges')), {
          devoteeId: id,
          devoteeName: data.name,
          ...c,
          changedBy,
          changedAt: serverTimestamp(),
          changedAtClient: new Date().toISOString(),
        });
      });
      await batch.commit();
    }
    bustCache();
    return { id, ...data };
  },

  async softDeleteDevotee(id) {
    await updateDoc(doc(db, 'devotees', id), { isActive: false, updatedAt: serverTimestamp() });
    bustCache();
  },

  async getProfileHistory(id) {
    const snap = await getDocs(
      query(collection(db, 'profileChanges'), where('devoteeId', '==', id), orderBy('changedAt', 'desc'))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async importDevotees(rows, mode = 'add') {
    const list = await getCache();
    let imported = 0, updated = 0, skipped = 0, errors = 0;
    const chunks = chunkArray(rows, 400);
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const row of chunk) {
        try {
          const data = toCamel(row);
          const dup = list.find(d =>
            (d.name || '').toLowerCase() === data.name.toLowerCase() &&
            (d.mobile || '') === data.mobile
          );
          if (dup) {
            if (mode === 'upsert') {
              batch.update(doc(db, 'devotees', dup.id), { ...data, updatedAt: serverTimestamp() });
              updated++;
            } else { skipped++; }
          } else {
            batch.set(doc(collection(db, 'devotees')), {
              ...data, isActive: true, lifetimeAttendance: data.priorSessions || 0,
              createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
            });
            imported++;
          }
        } catch { errors++; }
      }
      await batch.commit();
    }
    bustCache();
    return { imported, updated, skipped, errors };
  },

  // ── Sessions ────────────────────────────────────────────────────────────────
  async getTodaySession() {
    const todayStr = toLocalDateStr();
    const snap = await getDocs(
      query(collection(db, 'sessions'), orderBy('session_date', 'desc'), limit(1))
    );
    if (snap.empty) {
      const sun = snapToSunday(todayStr);
      const ref = await addDoc(collection(db, 'sessions'), { session_date: sun, is_cancelled: false });
      return { id: ref.id, session_date: sun };
    }
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  },

  async getOrCreateSession(dateStr) {
    const sun = snapToSunday(dateStr);
    const snap = await getDocs(query(collection(db, 'sessions'), where('session_date', '==', sun)));
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
    const ref = await addDoc(collection(db, 'sessions'), { session_date: sun, is_cancelled: false });
    return { id: ref.id, session_date: sun };
  },

  async getSessions() {
    const snap = await getDocs(query(collection(db, 'sessions'), orderBy('session_date', 'desc'), limit(52)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async getSessionsWithPresent() {
    const sessions = await this.getSessions();
    const results = await Promise.all(sessions.map(async s => {
      const att = await getDocs(query(collection(db, 'attendanceRecords'), where('session_id', '==', s.id)));
      return { ...s, present: att.size };
    }));
    return results;
  },

  async configureSunday(sessionId, { topic, isCancelled }) {
    await updateDoc(doc(db, 'sessions', sessionId), { topic: topic || '', is_cancelled: !!isCancelled });
  },

  async getSessionStats(sessionId) {
    const att = await getDocs(query(collection(db, 'attendanceRecords'), where('session_id', '==', sessionId)));
    const present = att.size;
    const newDevotees = att.docs.filter(d => d.data().is_new_devotee).length;
    return { present, newDevotees, confirmed: 0, totalPresent: present };
  },

  // ── Attendance ──────────────────────────────────────────────────────────────
  async getAttendanceCandidates(sessionId, search = '', team = '') {
    let list = await getCache();
    list = list.filter(d => d.isActive !== false && d.callingMode !== 'not_interested');
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(d => (d.name || '').toLowerCase().includes(q) || (d.mobile || '').includes(q));
    }
    if (team) list = list.filter(d => d.teamName === team || d.team_name === team);

    const attSnap = await getDocs(query(collection(db, 'attendanceRecords'), where('session_id', '==', sessionId)));
    const presentMap = {};
    attSnap.docs.forEach(d => { presentMap[d.data().devotee_id] = d.data().marked_at_client || null; });

    return list.map(d => ({
      ...toSnake(d),
      marked_at_client: presentMap[d.id] || null,
      is_present: !!presentMap[d.id],
    }));
  },

  async markPresent(sessionId, devotee, isNewDevotee = false) {
    const existing = await getDocs(
      query(collection(db, 'attendanceRecords'),
        where('session_id', '==', sessionId),
        where('devotee_id', '==', devotee.id))
    );
    if (!existing.empty) throw Object.assign(new Error('Already marked'), { code: 409 });
    await addDoc(collection(db, 'attendanceRecords'), {
      session_id: sessionId,
      devotee_id: devotee.id,
      devotee_name: devotee.name,
      team_name: devotee.teamName || devotee.team_name || '',
      is_new_devotee: isNewDevotee,
      marked_at: serverTimestamp(),
      marked_at_client: new Date().toISOString(),
    });
    await updateDoc(doc(db, 'devotees', devotee.id), {
      lifetimeAttendance: increment(1),
      inactivityFlag: false,
      updatedAt: serverTimestamp(),
    });
    bustCache();
  },

  async undoPresent(sessionId, devoteeId) {
    const snap = await getDocs(
      query(collection(db, 'attendanceRecords'),
        where('session_id', '==', sessionId),
        where('devotee_id', '==', devoteeId))
    );
    if (snap.empty) return;
    await deleteDoc(snap.docs[0].ref);
    await updateDoc(doc(db, 'devotees', devoteeId), {
      lifetimeAttendance: increment(-1),
      updatedAt: serverTimestamp(),
    });
    bustCache();
  },

  async getSessionAttendance(sessionId) {
    const snap = await getDocs(
      query(collection(db, 'attendanceRecords'), where('session_id', '==', sessionId), orderBy('marked_at', 'desc'))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async getSheetData(yearStart, yearEnd) {
    const [sessSnap, devList, attSnap, csSnap] = await Promise.all([
      getDocs(query(collection(db, 'sessions'), where('session_date', '>=', yearStart), where('session_date', '<=', yearEnd), orderBy('session_date'))),
      getCache(),
      getDocs(query(collection(db, 'attendanceRecords'))),
      getDocs(query(collection(db, 'callingStatus'))),
    ]);
    const sessions = sessSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const attMap = {};
    attSnap.docs.forEach(d => {
      const dat = d.data();
      if (!attMap[dat.session_id]) attMap[dat.session_id] = new Set();
      attMap[dat.session_id].add(dat.devotee_id);
    });
    const csMap = {};
    csSnap.docs.forEach(d => {
      const dat = d.data();
      if (!csMap[dat.week_date]) csMap[dat.week_date] = {};
      csMap[dat.week_date][dat.devotee_id] = dat.coming_status || dat.comingStatus || '';
    });
    return { sessions, devotees: devList.map(toSnake), attMap, csMap };
  },

  // ── Calling status ──────────────────────────────────────────────────────────
  async getCallingWeekConfig() {
    const snap = await getDoc(doc(db, 'settings', 'callingWeekConfig'));
    return snap.exists() ? snap.data() : null;
  },

  async setCallingWeekConfig(callingDate, sessionDate, extra = {}) {
    await setDoc(doc(db, 'settings', 'callingWeekConfig'), {
      callingDate, sessionDate, ...extra, updatedAt: serverTimestamp(),
    }, { merge: true });
  },

  async getTeamCallingStatus(weekDate, userRole, userTeam) {
    const snap = await getDocs(query(collection(db, 'callingStatus'), where('week_date', '==', weekDate)));
    let devotees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (userRole === 'teamAdmin') {
      devotees = devotees.filter(d => (d.team_name || d.teamName) === userTeam);
    }
    const subSnap = await getDocs(query(collection(db, 'callingSubmissions'), where('week_date', '==', weekDate)));
    const submittedCallers = new Set(subSnap.docs.map(d => d.data().user_name || d.data().userName));
    return { devotees, submittedCallers };
  },

  async updateCallingStatus(devoteeId, weekDate, data) {
    const existing = await getDocs(
      query(collection(db, 'callingStatus'),
        where('devotee_id', '==', devoteeId),
        where('week_date', '==', weekDate))
    );
    const payload = { ...data, week_date: weekDate, devotee_id: devoteeId, updated_at: serverTimestamp(), updated_at_client: new Date().toISOString() };
    if (existing.empty) {
      await addDoc(collection(db, 'callingStatus'), payload);
    } else {
      await updateDoc(existing.docs[0].ref, payload);
    }
  },

  async submitCallingWeek(weekDate, userId, userName, teamName) {
    const docId = `${userId}_${weekDate}`;
    const existing = await getDoc(doc(db, 'callingSubmissions', docId));
    if (existing.exists()) {
      await updateDoc(doc(db, 'callingSubmissions', docId), {
        last_submitted_at: serverTimestamp(),
        last_submitted_at_client: new Date().toISOString(),
      });
    } else {
      await setDoc(doc(db, 'callingSubmissions', docId), {
        week_date: weekDate, user_id: userId, user_name: userName, team_name: teamName,
        submitted_at: serverTimestamp(),
        submitted_at_client: new Date().toISOString(),
      });
    }
  },

  async getCallingSubmissions(weekDates) {
    const result = {};
    for (const wd of weekDates) {
      const snap = await getDocs(query(collection(db, 'callingSubmissions'), where('week_date', '==', wd)));
      result[wd] = {};
      snap.docs.forEach(d => {
        const dat = d.data();
        result[wd][dat.user_name || dat.userName] = dat;
      });
    }
    return result;
  },

  async getMyCallingSubmission(weekDate, userId) {
    const docId = `${userId}_${weekDate}`;
    const snap = await getDoc(doc(db, 'callingSubmissions', docId));
    return snap.exists() ? snap.data() : null;
  },

  async getCallingReport(weekDate) {
    const csSnap = await getDocs(query(collection(db, 'callingStatus'), where('week_date', '==', weekDate)));
    const subSnap = await getDocs(query(collection(db, 'callingSubmissions'), where('week_date', '==', weekDate)));
    const sessionDate = shiftDate(weekDate, 1);
    const sessSnap = await getDocs(query(collection(db, 'sessions'), where('session_date', '==', sessionDate)));
    const sessionId = sessSnap.empty ? null : sessSnap.docs[0].id;
    const attSet = new Set();
    if (sessionId) {
      const attSnap = await getDocs(query(collection(db, 'attendanceRecords'), where('session_id', '==', sessionId)));
      attSnap.docs.forEach(d => attSet.add(d.data().devotee_id));
    }
    const submittedCallers = new Set(subSnap.docs.map(d => d.data().user_name || d.data().userName));
    const report = {};
    for (const d of csSnap.docs) {
      const dat = d.data();
      const team = dat.team_name || dat.teamName || 'Unknown';
      const caller = dat.calling_by || dat.callingBy || 'Unknown';
      if (!submittedCallers.has(caller)) continue;
      if (!report[team]) report[team] = {};
      if (!report[team][caller]) report[team][caller] = { called: 0, yes: 0, notCalled: 0, came: 0 };
      const r = report[team][caller];
      r.called++;
      const cs = dat.coming_status || dat.comingStatus;
      if (cs === 'Yes') r.yes++;
      if (!cs) r.notCalled++;
      if (attSet.has(dat.devotee_id)) r.came++;
    }
    return report;
  },

  async getCallingHistoryGrid(teamFilter, callerFilter) {
    const today = toLocalDateStr();
    const weeks = [];
    let cur = shiftDate(snapToSunday(today), -1);
    for (let i = 0; i < 4; i++) {
      weeks.unshift(cur);
      cur = shiftDate(cur, -7);
    }
    const devotees = await this.getDevotees({ team: teamFilter, callingBy: callerFilter });
    const submMap = await this.getCallingSubmissions(weeks);
    return { weeks, devotees, submMap };
  },

  async getCallingHistory(devoteeId, weeksBefore = 4) {
    const snap = await getDocs(
      query(collection(db, 'callingStatus'),
        where('devotee_id', '==', devoteeId),
        orderBy('week_date', 'desc'),
        limit(weeksBefore))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async getSubmissionReport() {
    const today = toLocalDateStr();
    const weeks = [];
    let cur = shiftDate(snapToSunday(today), -1);
    for (let i = 0; i < 4; i++) {
      weeks.unshift(cur);
      cur = shiftDate(cur, -7);
    }
    const submMap = await this.getCallingSubmissions(weeks);
    const usersSnap = await getDocs(collection(db, 'users'));
    const teamRows = {};
    usersSnap.docs.forEach(d => {
      const dat = d.data();
      if (dat.role === 'serviceDevotee' || dat.role === 'teamAdmin') {
        const team = dat.teamName || dat.team_name || '';
        if (!teamRows[team]) teamRows[team] = [];
        teamRows[team].push({ userId: d.id, userName: dat.displayName || dat.name || '', teamName: team });
      }
    });
    return { fourWeeks: weeks, submMap, teamRows };
  },

  async getYesAbsentList(callingDate, sessionDate) {
    const csSnap = await getDocs(query(collection(db, 'callingStatus'), where('week_date', '==', callingDate)));
    const yesDevotees = csSnap.docs.filter(d => (d.data().coming_status || d.data().comingStatus) === 'Yes').map(d => d.data());
    if (!sessionDate) return { hasSession: false, list: yesDevotees };
    const sessSnap = await getDocs(query(collection(db, 'sessions'), where('session_date', '==', sessionDate)));
    if (sessSnap.empty) return { hasSession: false, list: yesDevotees };
    const sessionId = sessSnap.docs[0].id;
    const attSnap = await getDocs(query(collection(db, 'attendanceRecords'), where('session_id', '==', sessionId)));
    const attSet = new Set(attSnap.docs.map(d => d.data().devotee_id));
    const list = yesDevotees.filter(d => !attSet.has(d.devotee_id || d.devoteeId));
    return { hasSession: true, list };
  },

  // ── Care ───────────────────────────────────────────────────────────────────
  async getCareAbsent() {
    const sessions = await this.getSessions();
    if (sessions.length < 2) return { absentThisWeek: [], absentPast2Weeks: [] };
    const [s1, s2] = sessions;
    const [att1, att2] = await Promise.all([
      getDocs(query(collection(db, 'attendanceRecords'), where('session_id', '==', s1.id))),
      getDocs(query(collection(db, 'attendanceRecords'), where('session_id', '==', s2.id))),
    ]);
    const present1 = new Set(att1.docs.map(d => d.data().devotee_id));
    const present2 = new Set(att2.docs.map(d => d.data().devotee_id));
    const all = await this.getDevotees({});
    const active = all.filter(d => d.is_active !== false && d.calling_mode !== 'not_interested');
    return {
      absentThisWeek: active.filter(d => !present1.has(d.id)),
      absentPast2Weeks: active.filter(d => !present1.has(d.id) && !present2.has(d.id)),
    };
  },

  async getCareInactive() {
    const sessions = await this.getSessions();
    const recent3 = sessions.slice(0, 3);
    const attSets = await Promise.all(recent3.map(s =>
      getDocs(query(collection(db, 'attendanceRecords'), where('session_id', '==', s.id)))
        .then(snap => new Set(snap.docs.map(d => d.data().devotee_id)))
    ));
    const all = await this.getDevotees({});
    return all.filter(d => d.is_active !== false && attSets.every(s => !s.has(d.id)));
  },

  async getCareNewcomers() {
    const sessions = await this.getSessions();
    if (sessions.length < 1) return [];
    const attSnap = await getDocs(query(collection(db, 'attendanceRecords'), where('session_id', '==', sessions[0].id), where('is_new_devotee', '==', true)));
    const ids = attSnap.docs.map(d => d.data().devotee_id);
    const all = await this.getDevotees({});
    return all.filter(d => ids.includes(d.id));
  },

  async getCareBirthdays() {
    const all = await this.getDevotees({});
    const today = new Date();
    return all.filter(d => {
      if (!d.dob) return false;
      const bday = new Date(d.dob);
      const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
      const diff = (thisYear - today) / 86400000;
      return diff >= -1 && diff <= 6;
    });
  },

  // ── Personal Meetings ──────────────────────────────────────────────────────
  async getPersonalMeetings() {
    const snap = await getDocs(query(collection(db, 'personalMeetings'), orderBy('scheduledDate', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async addPersonalMeeting(data) {
    const ref = await addDoc(collection(db, 'personalMeetings'), { ...data, createdAt: serverTimestamp() });
    return { id: ref.id, ...data };
  },

  async updatePersonalMeeting(id, data) {
    await updateDoc(doc(db, 'personalMeetings', id), { ...data, updatedAt: serverTimestamp() });
  },

  async deletePersonalMeeting(id) {
    await deleteDoc(doc(db, 'personalMeetings', id));
  },

  // ── Events ─────────────────────────────────────────────────────────────────
  async getEvents() {
    const snap = await getDocs(query(collection(db, 'events'), orderBy('event_date', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async createEvent(data) {
    const ref = await addDoc(collection(db, 'events'), { ...data, createdAt: serverTimestamp() });
    return { id: ref.id, ...data };
  },

  async updateEvent(id, data) {
    await updateDoc(doc(db, 'events', id), { ...data, updatedAt: serverTimestamp() });
  },

  async deleteEvent(id) {
    await deleteDoc(doc(db, 'events', id));
    const devSnap = await getDocs(query(collection(db, 'eventDevotees'), where('event_id', '==', id)));
    const batch = writeBatch(db);
    devSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  },

  async getEventDevotees(eventId) {
    const snap = await getDocs(query(collection(db, 'eventDevotees'), where('event_id', '==', eventId), orderBy('devotee_name')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async addEventDevotee(eventId, devotee) {
    const existing = await getDocs(query(collection(db, 'eventDevotees'), where('event_id', '==', eventId), where('devotee_id', '==', devotee.id)));
    if (!existing.empty) throw new Error('Already registered');
    await addDoc(collection(db, 'eventDevotees'), { event_id: eventId, devotee_id: devotee.id, devotee_name: devotee.name, team_name: devotee.teamName || '', createdAt: serverTimestamp() });
  },

  async removeEventDevotee(eventId, devoteeId) {
    const snap = await getDocs(query(collection(db, 'eventDevotees'), where('event_id', '==', eventId), where('devotee_id', '==', devoteeId)));
    if (!snap.empty) await deleteDoc(snap.docs[0].ref);
  },

  // ── Activity logs ──────────────────────────────────────────────────────────
  async addBookDistribution(data) {
    await addDoc(collection(db, 'bookDistributions'), { ...data, createdAt: serverTimestamp() });
  },
  async getBookDistributions({ startDate, endDate } = {}) {
    let q = startDate && endDate
      ? query(collection(db, 'bookDistributions'), where('date', '>=', startDate), where('date', '<=', endDate), orderBy('date', 'desc'))
      : query(collection(db, 'bookDistributions'), orderBy('date', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async addDonation(data) {
    await addDoc(collection(db, 'donations'), { ...data, createdAt: serverTimestamp() });
  },
  async getDonations({ startDate, endDate } = {}) {
    let q = startDate && endDate
      ? query(collection(db, 'donations'), where('date', '>=', startDate), where('date', '<=', endDate), orderBy('date', 'desc'))
      : query(collection(db, 'donations'), orderBy('date', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async addRegistration(data) {
    await addDoc(collection(db, 'registrations'), { ...data, createdAt: serverTimestamp() });
  },
  async getRegistrations({ startDate, endDate } = {}) {
    let q = startDate && endDate
      ? query(collection(db, 'registrations'), where('date', '>=', startDate), where('date', '<=', endDate), orderBy('date', 'desc'))
      : query(collection(db, 'registrations'), orderBy('date', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async addService(data) {
    await addDoc(collection(db, 'services'), { ...data, createdAt: serverTimestamp() });
  },
  async getServices({ startDate, endDate } = {}) {
    let q = startDate && endDate
      ? query(collection(db, 'services'), where('date', '>=', startDate), where('date', '<=', endDate), orderBy('date', 'desc'))
      : query(collection(db, 'services'), orderBy('date', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // ── Users & Auth ───────────────────────────────────────────────────────────
  async getUsers(search = '') {
    const snap = await getDocs(collection(db, 'users'));
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u => (u.displayName || u.name || '').toLowerCase().includes(q));
    }
    return list;
  },

  async getUsersForTeam(team, search = '') {
    const all = await this.getUsers(search);
    return team ? all.filter(u => (u.teamName || u.team_name || '') === team) : all;
  },

  // ── KEY FIX: check if ANY superAdmin exists, not just if users collection is empty ──
  async hasSuperAdmin() {
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'superAdmin'), limit(1)));
    return !snap.empty;
  },

  async createFirstUser(uid, displayName) {
    await setDoc(doc(db, 'users', uid), {
      role: 'superAdmin',
      displayName,
      teamName: '',
      isActive: true,
      createdAt: serverTimestamp(),
    });
  },

  async getPendingSignups() {
    const snap = await getDocs(query(collection(db, 'signupRequests'), where('status', '==', 'pending')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async approveSignupRequest(requestId, uid, role, teamName, displayName) {
    await setDoc(doc(db, 'users', uid), { role, teamName, displayName, isActive: true, createdAt: serverTimestamp() });
    await updateDoc(doc(db, 'signupRequests', requestId), { status: 'approved', updatedAt: serverTimestamp() });
  },

  async rejectSignupRequest(requestId) {
    await updateDoc(doc(db, 'signupRequests', requestId), { status: 'rejected', updatedAt: serverTimestamp() });
  },

  async createSignupRequest(uid, displayName, email) {
    await setDoc(doc(db, 'signupRequests', uid), {
      uid, displayName, email, status: 'pending', createdAt: serverTimestamp(),
    });
  },

  async updateCallingByName(oldName, newName) {
    const snap = await getDocs(query(collection(db, 'devotees'), where('callingBy', '==', oldName)));
    const chunks = chunkArray(snap.docs, 400);
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(d => batch.update(d.ref, { callingBy: newName }));
      await batch.commit();
    }
    bustCache();
  },

  async renameTeam(oldName, newName) {
    if (!newName || oldName === newName) throw new Error('Invalid team name');
    const collections = ['devotees','users','callingStatus','callingSubmissions','attendanceRecords','bookDistributions','services','registrations','donations'];
    let total = 0;
    for (const col of collections) {
      const snap = await getDocs(query(collection(db, col), where('team_name', '==', oldName)));
      const chunks = chunkArray(snap.docs, 400);
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(d => batch.update(d.ref, { team_name: newName }));
        await batch.commit();
        total += chunk.length;
      }
    }
    bustCache();
    return total;
  },

  async getAttendanceTargets() {
    const snap = await getDoc(doc(db, 'settings', 'attendanceTargets'));
    return snap.exists() ? snap.data() : { type: 'none', teams: {}, global: 0 };
  },

  async setAttendanceTargets(type, teams, global = 0) {
    await setDoc(doc(db, 'settings', 'attendanceTargets'), { type, teams, global, updatedAt: serverTimestamp() });
  },

  async setDevoteeCallingMode(devoteeId, mode) {
    const updates = { callingMode: mode, updatedAt: serverTimestamp() };
    if (mode === 'not_interested') { updates.callingBy = ''; updates.teamName = ''; }
    else if (mode === 'online' || mode === 'festival') updates.callingBy = '';
    await updateDoc(doc(db, 'devotees', devoteeId), updates);
    bustCache();
  },

  async getTrends(period = 'weekly', team = '') {
    const sessions = await this.getSessionsWithPresent();
    return sessions.slice(0, 20).map(s => ({ period: s.session_date, count: s.present })).reverse();
  },

  async getTeamsReport(weekDate, sessionId) {
    const devotees = await this.getDevotees({});
    const csSnap = await getDocs(query(collection(db, 'callingStatus'), where('week_date', '==', weekDate)));
    const attSnap = sessionId
      ? await getDocs(query(collection(db, 'attendanceRecords'), where('session_id', '==', sessionId)))
      : { docs: [] };
    const attSet = new Set(attSnap.docs.map(d => d.data().devotee_id));
    const csMap = {};
    csSnap.docs.forEach(d => { const dat = d.data(); csMap[dat.devotee_id || dat.devoteeId] = dat.coming_status || dat.comingStatus || ''; });
    const targetSnap = await this.getAttendanceTargets();
    const teams = {};
    devotees.forEach(d => {
      const t = d.team_name || 'Unknown';
      if (!teams[t]) teams[t] = { team: t, total: 0, callingList: 0, target: 0, actualPresent: 0, percentage: 0 };
      teams[t].total++;
      if (csMap[d.id]) teams[t].callingList++;
      if (attSet.has(d.id)) teams[t].actualPresent++;
    });
    return Object.values(teams).map(t => {
      const target = targetSnap.teams?.[t.team] || targetSnap.global || 0;
      return { ...t, target, percentage: target ? Math.round((t.actualPresent / target) * 100) : 0 };
    });
  },

  async getMgmtSeparateLists() {
    const all = await getCache();
    return {
      online: all.filter(d => d.callingMode === 'online').map(toSnake),
      festival: all.filter(d => d.callingMode === 'festival').map(toSnake),
      notInterested: all.filter(d => d.callingMode === 'not_interested' || d.calling_mode === 'not_interested').map(toSnake),
    };
  },

  subscribeToCollection(col, onData, queryConstraints = []) {
    const q = queryConstraints.length
      ? query(collection(db, col), ...queryConstraints)
      : collection(db, col);
    return onSnapshot(q, snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  },
};
