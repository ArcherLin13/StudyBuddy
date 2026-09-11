import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { playAlarm, stopAlarm } from '../audio/alarm';
import { pushStudyData } from '../sync/studySync';
import { elapsedMs, formatMmSs, remainingMs, todayStr } from '../date';
import {
  addRecord,
  loadSession,
  loadSettings,
  loadSubjects,
  saveSession,
} from '../storage/store';
import { DEFAULT_SETTINGS, type SessionCurrent, Settings, StudySession, Subject } from '../types';

export type TimerView = {
  subjectName: string;
  timeText: string;
  hint: string;
  btnMode: 'play' | 'pause' | 'resume';
  showEnd: boolean;
  running: boolean;
};

const idleView: TimerView = {
  subjectName: '',
  timeText: '00:00',
  hint: '准备开始',
  btnMode: 'play',
  showEnd: false,
  running: false,
};

function toView(session: StudySession | null, subjects: Subject[], now: number): TimerView {
  const showEnd = !!(session && session.active);
  if (session?.current) {
    const running = session.current.status === 'running';
    return {
      subjectName: session.current.subjectName,
      timeText: formatMmSs(remainingMs(session.current, now)),
      hint: running ? '学习中' : '已暂停',
      btnMode: running ? 'pause' : 'resume',
      showEnd,
      running,
    };
  }
  const next = nextSubject(session, subjects);
  if (!next) {
    return { ...idleView, subjectName: '请添加科目', hint: '去设置里添加' };
  }
  return {
    subjectName: next.subject.name,
    timeText: formatMmSs(next.subject.durationMin * 60 * 1000),
    hint: session?.active ? '下一科' : '准备开始',
    btnMode: 'play',
    showEnd,
    running: false,
  };
}

function nextSubject(
  session: StudySession | null,
  subjects: Subject[]
): { subject: Subject; index: number } | null {
  if (!subjects.length) return null;
  let index = session && typeof session.nextIndex === 'number' ? session.nextIndex : 0;
  index = ((index % subjects.length) + subjects.length) % subjects.length;
  return { subject: subjects[index], index };
}

export function useStudyTimer() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [view, setView] = useState<TimerView>(idleView);
  const sessionRef = useRef<StudySession | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef(0);

  const persist = async (session: StudySession | null) => {
    sessionRef.current = session;
    await saveSession(session);
  };

  const refreshView = useCallback((session = sessionRef.current, list = subjects) => {
    setView(toView(session, list, Date.now()));
  }, [subjects]);

  const clearTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const setKeep = (on: boolean) => {
    if (on) void activateKeepAwakeAsync();
    else void deactivateKeepAwake();
  };

  const commit = async (current: SessionCurrent, seconds: number) => {
    if (seconds < 1) return;
    await addRecord({
      date: todayStr(),
      subjectId: current.subjectId,
      subjectName: current.subjectName,
      seconds,
      startTs: current.startTs,
      endTs: Date.now(),
    });
    void pushStudyData();
  };

  const completeCurrent = async () => {
    const session = sessionRef.current;
    if (!session?.current) return;
    const current = session.current;
    await commit(current, current.durationSec);
    const list = await loadSubjects();
    const len = Math.max(1, list.length);
    session.nextIndex = (session.nextIndex + 1) % len;
    session.current = null;
    session.active = true;
    await persist(session);
    clearTick();
    setKeep(false);
    await playAlarm(settings.soundOn);
    setSubjects(list);
    refreshView(session, list);
  };

  const recover = async () => {
    const session = await loadSession();
    if (!session?.current || session.current.status !== 'running') {
      sessionRef.current = session;
      clearTick();
      refreshView(session);
      return;
    }
    const now = Date.now();
    const gap = session.current.startedAt ? now - session.current.startedAt : 0;
    if (gap > 3000) {
      session.current.status = 'paused';
      session.current.startedAt = null;
    } else if (remainingMs(session.current, now) <= 0) {
      sessionRef.current = session;
      await completeCurrent();
      return;
    } else {
      session.current.elapsedMsBeforePause = elapsedMs(session.current, now);
      session.current.status = 'paused';
      session.current.startedAt = null;
    }
    await persist(session);
    clearTick();
    refreshView(session);
  };

  const startTick = () => {
    clearTick();
    tickRef.current = setInterval(() => {
      const session = sessionRef.current;
      if (!session?.current || session.current.status !== 'running') {
        clearTick();
        return;
      }
      const now = Date.now();
      if (remainingMs(session.current, now) <= 0) {
        void completeCurrent();
        return;
      }
      if (!heartbeatRef.current || now - heartbeatRef.current > 1000) {
        session.current.elapsedMsBeforePause = elapsedMs(session.current, now);
        session.current.startedAt = now;
        void persist(session);
        heartbeatRef.current = now;
      }
      refreshView(session);
    }, 200);
  };

  const pause = async () => {
    const session = sessionRef.current;
    if (!session?.current || session.current.status !== 'running') return;
    const now = Date.now();
    session.current.elapsedMsBeforePause = elapsedMs(session.current, now);
    session.current.startedAt = null;
    session.current.status = 'paused';
    await persist(session);
    clearTick();
    setKeep(false);
    refreshView(session);
  };

  const startOrResume = async () => {
    stopAlarm();
    const list = await loadSubjects();
    setSubjects(list);
    if (!list.length) return;
    let session = sessionRef.current;
    if (session?.current?.status === 'paused') {
      session.current.status = 'running';
      session.current.startedAt = Date.now();
      await persist(session);
      setKeep(true);
      startTick();
      refreshView(session, list);
      return;
    }
    if (!session) session = { active: true, nextIndex: 0, current: null };
    const next = nextSubject(session, list);
    if (!next) return;
    session.active = true;
    session.nextIndex = next.index;
    session.current = {
      subjectId: next.subject.id,
      subjectName: next.subject.name,
      durationSec: Math.max(1, Number(next.subject.durationMin) || 1) * 60,
      startTs: Date.now(),
      elapsedMsBeforePause: 0,
      startedAt: Date.now(),
      status: 'running',
    };
    await persist(session);
    setKeep(true);
    startTick();
    refreshView(session, list);
  };

  const endSession = async () => {
    const session = sessionRef.current;
    if (!session) return;
    if (session.current) {
      await commit(session.current, Math.floor(elapsedMs(session.current, Date.now()) / 1000));
    }
    await persist(null);
    clearTick();
    setKeep(false);
    stopAlarm();
    refreshView(null);
  };

  const reloadConfig = async () => {
    const [list, nextSettings] = await Promise.all([loadSubjects(), loadSettings()]);
    setSubjects(list);
    setSettings(nextSettings);
    refreshView(sessionRef.current, list);
  };

  useEffect(() => {
    void (async () => {
      await reloadConfig();
      await recover();
    })();
    return () => {
      clearTick();
      setKeep(false);
    };
  }, []);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state !== 'active') void pause();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  return {
    view,
    subjects,
    settings,
    startOrResume,
    pause,
    endSession,
    reloadConfig,
  };
}
