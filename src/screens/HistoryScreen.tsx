import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NavTitle } from '../components/NavTitle';
import { formatDayLabel } from '../date';
import { listWeekReports } from '../score';
import { daySubjectSlices, type DaySubjectSlice } from '../storage/store';
import type { Settings, StudyRecord, Subject, WeekMeta, WeekReport } from '../types';
import { colors, radius } from '../theme';

type Props = {
  records: StudyRecord[];
  weekMeta: Record<string, WeekMeta>;
  subjects: Subject[];
  settings: Settings;
  onDeleteDay: (date: string) => void;
  onDeleteSubject: (date: string, subjectName: string) => void;
  onEditSubject: (date: string, subjectName: string, minutes: number) => void;
};

type EditTarget = {
  date: string;
  subjectName: string;
  minutes: string;
};

export function HistoryScreen({
  records,
  weekMeta,
  subjects,
  settings,
  onDeleteDay,
  onDeleteSubject,
  onEditSubject,
}: Props) {
  const weeks = useMemo(
    () => listWeekReports(records, weekMeta, subjects, settings),
    [records, weekMeta, subjects, settings]
  );
  const [openId, setOpenId] = useState(weeks[0]?.weekId ?? '');
  const [edit, setEdit] = useState<EditTarget | null>(null);

  const confirmDeleteDay = (date: string) => {
    Alert.alert('删除当天', `删除 ${formatDayLabel(date)} 的全部学习记录？周分和奖励会重算。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => onDeleteDay(date) },
    ]);
  };

  const confirmDeleteSubject = (slice: DaySubjectSlice) => {
    Alert.alert(
      '删除科目记录',
      `删除 ${formatDayLabel(slice.date)}「${slice.subjectName}」的记录？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => onDeleteSubject(slice.date, slice.subjectName),
        },
      ]
    );
  };

  const saveEdit = () => {
    if (!edit) return;
    const minutes = Number(edit.minutes);
    if (!Number.isFinite(minutes) || minutes < 0) {
      Alert.alert('请输入有效的分钟数');
      return;
    }
    onEditSubject(edit.date, edit.subjectName, Math.min(600, Math.round(minutes)));
    setEdit(null);
  };

  return (
    <View style={styles.root}>
      <NavTitle title="历史" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {weeks.map((week) => (
          <WeekCard
            key={week.weekId}
            week={week}
            records={records}
            expanded={openId === week.weekId}
            onToggle={() => setOpenId(openId === week.weekId ? '' : week.weekId)}
            onDeleteDay={confirmDeleteDay}
            onDeleteSubject={confirmDeleteSubject}
            onEditSubject={(slice) =>
              setEdit({
                date: slice.date,
                subjectName: slice.subjectName,
                minutes: String(Math.max(1, Math.round(slice.seconds / 60))),
              })
            }
          />
        ))}
      </ScrollView>

      <Modal visible={!!edit} transparent animationType="fade" onRequestClose={() => setEdit(null)}>
        <Pressable style={styles.mask} onPress={() => setEdit(null)}>
          <Pressable style={styles.dialog} onPress={() => undefined}>
            <Text style={styles.dialogTitle}>修改时长</Text>
            <Text style={styles.dialogSub}>
              {edit ? `${formatDayLabel(edit.date)} · ${edit.subjectName}` : ''}
            </Text>
            <TextInput
              value={edit?.minutes ?? ''}
              onChangeText={(minutes) => setEdit(edit ? { ...edit, minutes } : null)}
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
              style={styles.dialogInput}
            />
            <Text style={styles.dialogHelp}>改成 0 分钟等于删除这条。</Text>
            <View style={styles.dialogRow}>
              <Pressable style={[styles.dialogBtn, { marginRight: 12 }]} onPress={() => setEdit(null)}>
                <Text style={styles.dialogCancel}>取消</Text>
              </Pressable>
              <Pressable style={[styles.dialogBtn, styles.dialogSave]} onPress={saveEdit}>
                <Text style={styles.dialogSaveText}>保存</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function WeekCard({
  week,
  records,
  expanded,
  onToggle,
  onDeleteDay,
  onDeleteSubject,
  onEditSubject,
}: {
  week: WeekReport;
  records: StudyRecord[];
  expanded: boolean;
  onToggle: () => void;
  onDeleteDay: (date: string) => void;
  onDeleteSubject: (slice: DaySubjectSlice) => void;
  onEditSubject: (slice: DaySubjectSlice) => void;
}) {
  return (
    <View style={styles.card}>
      <Pressable onPress={onToggle}>
        <View style={styles.head}>
          <View style={styles.headLeft}>
            <Text style={styles.title}>{week.isCurrent ? '本周' : week.rangeText}</Text>
            {week.isCurrent ? <Text style={styles.sub}>{week.rangeText}</Text> : null}
            <Text style={styles.meta}>总时长 {week.durationText}</Text>
          </View>
          <View style={styles.scoreWrap}>
            <Text style={styles.score}>{week.score}</Text>
            <Text style={styles.grade}>{week.grade}</Text>
          </View>
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.detail}>
          <Text style={styles.part}>时长分 {week.timeScore} / 60</Text>
          <Text style={styles.part}>稳定分 {week.stabilityScore} / 25</Text>
          <Text style={styles.part}>
            连击分 {week.comboScore} / 15（连续 {week.streakDays} 天）
          </Text>

          <Text style={styles.block}>每天 · 点科目可改时长</Text>
          {week.daily.map((day) => {
            const slices = daySubjectSlices(records, day.date);
            return (
              <View key={day.date} style={styles.dayBlock}>
                <View style={styles.row}>
                  <Text style={styles.wk}>
                    周{day.weekday} · {formatDayLabel(day.date)}
                  </Text>
                  <Text style={styles.dur}>{day.seconds ? day.durationText : '未学习'}</Text>
                </View>
                {slices.map((slice) => (
                  <View key={`${slice.date}-${slice.subjectName}`} style={styles.subRow}>
                    <Text style={styles.subName}>{slice.subjectName}</Text>
                    <Text style={[styles.subDur, { marginRight: 10 }]}>{Math.round(slice.seconds / 60)} 分钟</Text>
                    <Pressable onPress={() => onEditSubject(slice)} hitSlop={8}>
                      <Text style={styles.link}>改</Text>
                    </Pressable>
                    <Pressable onPress={() => onDeleteSubject(slice)} hitSlop={8} style={{ marginLeft: 10 }}>
                      <Text style={[styles.link, styles.danger]}>删</Text>
                    </Pressable>
                  </View>
                ))}
                {slices.length ? (
                  <Pressable onPress={() => onDeleteDay(day.date)} style={styles.dayDelete}>
                    <Text style={styles.dayDeleteText}>删除当天</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
  },
  body: {
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headLeft: {
    flex: 1,
  },
  title: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '600',
  },
  sub: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
  },
  meta: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 14,
  },
  scoreWrap: {
    alignItems: 'flex-end',
  },
  score: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 32,
  },
  grade: {
    color: colors.accent,
    fontSize: 12,
  },
  detail: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  part: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 22,
  },
  block: {
    marginTop: 14,
    marginBottom: 4,
    color: colors.muted,
    fontSize: 13,
  },
  dayBlock: {
    paddingTop: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  wk: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600',
  },
  dur: {
    color: colors.muted,
    fontSize: 15,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: 8,
  },
  subName: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
  },
  subDur: {
    color: colors.muted,
    fontSize: 14,
  },
  link: {
    color: colors.accent,
    fontSize: 14,
  },
  danger: {
    color: colors.danger,
  },
  dayDelete: {
    alignSelf: 'flex-start',
    marginTop: 2,
    marginBottom: 6,
    marginLeft: 8,
  },
  dayDeleteText: {
    color: colors.danger,
    fontSize: 13,
  },
  mask: {
    flex: 1,
    backgroundColor: 'rgba(44, 42, 38, 0.35)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  dialog: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 20,
  },
  dialogTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '600',
  },
  dialogSub: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 14,
  },
  dialogInput: {
    marginTop: 16,
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
    fontSize: 20,
    fontWeight: '600',
  },
  dialogHelp: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 12,
  },
  dialogRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 18,
  },
  dialogBtn: {
    minWidth: 72,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogSave: {
    backgroundColor: colors.accent,
  },
  dialogCancel: {
    color: colors.muted,
    fontSize: 15,
  },
  dialogSaveText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
