import { useCallback, useEffect, useState } from 'react';
import { Alert, StatusBar, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { TabBar, type TabKey } from './src/components/TabBar';
import { useStudyTimer } from './src/hooks/useStudyTimer';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import {
  deleteDayRecords,
  deleteDaySubjectRecords,
  loadRecords,
  loadWeekMeta,
  setDaySubjectMinutes,
} from './src/storage/store';
import {
  authErrorMessage,
  registerWithEmail,
  signInWithEmail,
  signOutAccount,
  subscribeAuth,
} from './src/sync/firebase';
import { isFirebaseConfigured } from './src/sync/firebaseConfig';
import { persistRecordChange, syncStudyData } from './src/sync/studySync';
import { colors } from './src/theme';
import type { StudyRecord, WeekMeta } from './src/types';

export default function App() {
  const timer = useStudyTimer();
  const [tab, setTab] = useState<TabKey>('timer');
  const [records, setRecords] = useState<StudyRecord[]>([]);
  const [weekMeta, setWeekMeta] = useState<Record<string, WeekMeta>>({});
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);

  const refreshHistory = useCallback(async () => {
    const [nextRecords, nextMeta] = await Promise.all([loadRecords(), loadWeekMeta()]);
    setRecords(nextRecords);
    setWeekMeta(nextMeta);
  }, []);

  const runSync = useCallback(async () => {
    if (!isFirebaseConfigured()) return;
    const result = await syncStudyData();
    setRecords(result.records);
    setWeekMeta(result.weekMeta);
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    return subscribeAuth((user) => {
      setAccountEmail(user?.email ?? null);
      if (!user) return;
      void runSync()
        .then(() => timer.reloadConfig())
        .catch(() => undefined);
    });
  }, [runSync]);

  const onChangeTab = (key: TabKey) => {
    setTab(key);
    if (key === 'history') void refreshHistory();
    if (key === 'config' || key === 'timer') void timer.reloadConfig();
  };

  const onMain = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (timer.view.running) {
      void timer.pause();
      return;
    }
    void timer.startOrResume();
  };

  const onEnd = () => {
    Alert.alert('结束本轮', '结束学习并回到第一科？已学时长会保留。', [
      { text: '取消', style: 'cancel' },
      {
        text: '结束',
        onPress: () => {
          void timer.endSession().then(() => refreshHistory());
        },
      },
    ]);
  };

  const doRegister = async (email: string, password: string) => {
    setSyncBusy(true);
    try {
      await registerWithEmail(email, password);
      Alert.alert('注册成功', '已登录，正在把本机记录同步到云端');
    } catch (e) {
      Alert.alert('注册失败', authErrorMessage(e));
    } finally {
      setSyncBusy(false);
    }
  };

  const doSignIn = async (email: string, password: string) => {
    setSyncBusy(true);
    try {
      await signInWithEmail(email, password);
      Alert.alert('登录成功', '正在按账号同步学习记录');
    } catch (e) {
      Alert.alert('登录失败', authErrorMessage(e));
    } finally {
      setSyncBusy(false);
    }
  };

  const applyRecordChange = async (change: Promise<{ records: StudyRecord[]; removed: StudyRecord[] }>) => {
    const { records: next, removed } = await change;
    setRecords(next);
    void persistRecordChange(next, removed);
  };

  const doSignOut = () => {
    Alert.alert('退出登录', '本机记录会保留，但不再和云端同步。', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: () => {
          void signOutAccount().then(() => setAccountEmail(null));
        },
      },
    ]);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" />
        <View style={{ flex: 1 }}>
          {tab === 'timer' ? (
            <HomeScreen view={timer.view} onMain={onMain} onEnd={onEnd} />
          ) : null}
          {tab === 'config' ? (
            <SettingsScreen
              subjects={timer.subjects}
              settings={timer.settings}
              accountEmail={accountEmail}
              syncBusy={syncBusy}
              onSubjects={() => void timer.reloadConfig()}
              onSettings={() => void timer.reloadConfig()}
              onRegister={(email, password) => void doRegister(email, password)}
              onSignIn={(email, password) => void doSignIn(email, password)}
              onSignOut={doSignOut}
            />
          ) : null}
          {tab === 'history' ? (
            <HistoryScreen
              records={records}
              weekMeta={weekMeta}
              subjects={timer.subjects}
              settings={timer.settings}
              onDeleteDay={(date) => void applyRecordChange(deleteDayRecords(date))}
              onDeleteSubject={(date, name) => void applyRecordChange(deleteDaySubjectRecords(date, name))}
              onEditSubject={(date, name, minutes) =>
                void applyRecordChange(setDaySubjectMinutes(date, name, minutes))
              }
            />
          ) : null}
        </View>
        <TabBar current={tab} onChange={onChangeTab} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
