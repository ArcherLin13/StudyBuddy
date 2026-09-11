import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import {
  loadPayouts,
  loadRecords,
  loadSettings,
  loadSubjects,
  loadWeekMeta,
  replaceRecords,
  savePayouts,
  saveSettings,
  saveSubjects,
  saveWeekMeta,
} from '../storage/store';
import type { DayPayout, Settings, StudyRecord, Subject, WeekMeta } from '../types';
import { getCurrentUser, getDb, requireUid } from './firebase';
import { isFirebaseConfigured } from './firebaseConfig';

export type CloudBundle = {
  subjects: Subject[];
  settings: Settings;
  weekMeta: Record<string, WeekMeta>;
  payouts?: Record<string, DayPayout>;
  updatedAt: number;
};

export function recordId(r: StudyRecord): string {
  if (r.id) return r.id;
  return `r_${r.startTs}_${r.endTs}_${r.subjectId}_${r.seconds}`;
}

function recordsCol(uid: string) {
  return collection(getDb(), 'users', uid, 'studybuddy_records');
}

function metaRef(uid: string) {
  return doc(getDb(), 'users', uid, 'studybuddy_meta', 'app');
}

export function mergeRecords(local: StudyRecord[], remote: StudyRecord[]): StudyRecord[] {
  const map = new Map<string, StudyRecord>();
  for (const r of local) {
    const id = recordId(r);
    map.set(id, { ...r, id });
  }
  for (const r of remote) {
    const id = recordId(r);
    if (!map.has(id)) map.set(id, { ...r, id });
  }
  return [...map.values()].sort((a, b) => a.startTs - b.startTs);
}

export async function syncStudyData(): Promise<{
  records: StudyRecord[];
  subjects: Subject[];
  settings: Settings;
  weekMeta: Record<string, WeekMeta>;
}> {
  if (!isFirebaseConfigured()) throw new Error('Firebase 尚未配置');
  const uid = requireUid();
  const [localRecords, localSubjects, localSettings, localMeta, localPayouts] = await Promise.all([
    loadRecords(),
    loadSubjects(),
    loadSettings(),
    loadWeekMeta(),
    loadPayouts(),
  ]);

  const remoteSnap = await getDocs(recordsCol(uid));
  const remoteRecords: StudyRecord[] = [];
  remoteSnap.forEach((d) => {
    const data = d.data() as StudyRecord;
    if (data && data.startTs) remoteRecords.push({ ...data, id: data.id || d.id });
  });

  const merged = mergeRecords(localRecords, remoteRecords);
  await replaceRecords(merged);
  for (const r of merged) {
    await setDoc(doc(recordsCol(uid), recordId(r)), { ...r, id: recordId(r) }, { merge: true });
  }

  const metaSnap = await getDoc(metaRef(uid));
  const remote = metaSnap.exists() ? (metaSnap.data() as CloudBundle) : null;
  const localUpdated = localSettings.updatedAt || 0;
  const remoteUpdated = remote?.updatedAt || 0;

  let subjects = localSubjects;
  let settings = localSettings;
  let weekMeta = localMeta;
  let payouts = localPayouts;

  if (remote && remoteUpdated >= localUpdated) {
    if (remote.subjects?.length) {
      subjects = await saveSubjects(remote.subjects);
    }
    if (remote.settings) {
      settings = { ...localSettings, ...remote.settings };
      await saveSettings(settings);
    }
    if (remote.weekMeta) {
      weekMeta = { ...localMeta, ...remote.weekMeta };
      await saveWeekMeta(weekMeta);
    }
    if (remote.payouts) {
      payouts = { ...localPayouts, ...remote.payouts };
      await savePayouts(payouts);
    }
  } else {
    await setDoc(
      metaRef(uid),
      {
        subjects,
        settings,
        weekMeta,
        payouts,
        updatedAt: Math.max(localUpdated, Date.now()),
      },
      { merge: true }
    );
  }

  return { records: merged, subjects, settings, weekMeta, payouts };
}

export async function persistRecordChange(
  records: StudyRecord[],
  removed: StudyRecord[] = []
): Promise<void> {
  if (!isFirebaseConfigured() || !getCurrentUser()) return;
  try {
    const uid = requireUid();
    for (const r of removed) {
      await deleteDoc(doc(recordsCol(uid), recordId(r)));
    }
    for (const r of records) {
      await setDoc(doc(recordsCol(uid), recordId(r)), { ...r, id: recordId(r) }, { merge: true });
    }
  } catch {
    /* offline */
  }
}

export async function pushStudyData(): Promise<void> {
  if (!isFirebaseConfigured() || !getCurrentUser()) return;
  try {
    await syncStudyData();
  } catch {
    /* offline */
  }
}
