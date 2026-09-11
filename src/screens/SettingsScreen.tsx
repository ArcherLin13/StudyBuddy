import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { NavTitle } from '../components/NavTitle';
import { makeId, saveSettings, saveSubjects } from '../storage/store';
import { pushStudyData } from '../sync/studySync';
import type { Settings, Subject } from '../types';
import { colors, radius } from '../theme';

type Props = {
  subjects: Subject[];
  settings: Settings;
  accountEmail: string | null;
  syncBusy: boolean;
  onSubjects: () => void;
  onSettings: () => void;
  onRegister: (email: string, password: string) => void;
  onSignIn: (email: string, password: string) => void;
  onSignOut: () => void;
};

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function SettingsScreen({
  subjects,
  settings,
  accountEmail,
  syncBusy,
  onSubjects,
  onSettings,
  onRegister,
  onSignIn,
  onSignOut,
}: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const persistSubjects = (list: Subject[]) => {
    void saveSubjects(list).then(() => {
      onSubjects();
      void pushStudyData();
    });
  };

  const persistSettings = (next: Settings) => {
    void saveSettings(next).then(() => {
      onSettings();
      void pushStudyData();
    });
  };

  const rename = (index: number, name: string) => {
    const list = subjects.slice();
    list[index] = { ...list[index], name };
    persistSubjects(list);
  };

  const setDuration = (index: number, value: number) => {
    const list = subjects.slice();
    list[index] = { ...list[index], durationMin: clamp(value, 1, 180) };
    persistSubjects(list);
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= subjects.length) return;
    const list = subjects.slice();
    const tmp = list[index];
    list[index] = list[next];
    list[next] = tmp;
    persistSubjects(list);
  };

  const remove = (index: number) => {
    if (subjects.length <= 1) {
      Alert.alert('至少保留一个科目');
      return;
    }
    Alert.alert('删除科目', `删除「${subjects[index].name}」？历史记录仍会保留。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          const list = subjects.slice();
          list.splice(index, 1);
          persistSubjects(list);
        },
      },
    ]);
  };

  const add = () => {
    const letter = String.fromCharCode(65 + (subjects.length % 26));
    persistSubjects([
      ...subjects,
      { id: makeId('sub'), name: `科目${letter}`, durationMin: 25, order: subjects.length },
    ]);
  };

  return (
    <View style={styles.root}>
      <NavTitle title="配置" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.section}>科目顺序与时长</Text>
        {subjects.map((item, index) => (
          <View key={item.id} style={styles.card}>
            <TextInput
              value={item.name}
              onChangeText={(text) => rename(index, text)}
              onEndEditing={() => {
                if (!item.name.trim()) rename(index, '未命名科目');
              }}
              maxLength={12}
              style={styles.name}
            />
            <View style={styles.row}>
              <Text style={styles.label}>时长（分钟）</Text>
              <View style={styles.stepper}>
                <Pressable style={styles.step} onPress={() => setDuration(index, item.durationMin - 1)}>
                  <Text style={styles.stepText}>−</Text>
                </Pressable>
                <Text style={styles.num}>{item.durationMin}</Text>
                <Pressable style={styles.step} onPress={() => setDuration(index, item.durationMin + 1)}>
                  <Text style={styles.stepText}>+</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.actions}>
              <Pressable onPress={() => move(index, -1)} disabled={index === 0}>
                <Text style={[styles.link, index === 0 && styles.disabled]}>上移</Text>
              </Pressable>
              <Pressable onPress={() => move(index, 1)} disabled={index === subjects.length - 1}>
                <Text style={[styles.link, index === subjects.length - 1 && styles.disabled]}>下移</Text>
              </Pressable>
              <Pressable onPress={() => remove(index)}>
                <Text style={[styles.link, styles.danger]}>删除</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <Pressable onPress={add} style={({ pressed }) => [styles.add, pressed && styles.addPressed]}>
          <Text style={styles.addText}>添加科目</Text>
        </Pressable>

        <Text style={styles.section}>打分规则</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>每周计划学习天数</Text>
            <View style={styles.stepper}>
              <Pressable
                style={styles.step}
                onPress={() =>
                  persistSettings({
                    ...settings,
                    planDaysPerWeek: clamp(settings.planDaysPerWeek - 1, 1, 7),
                  })
                }
              >
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.num}>{settings.planDaysPerWeek}</Text>
              <Pressable
                style={styles.step}
                onPress={() =>
                  persistSettings({
                    ...settings,
                    planDaysPerWeek: clamp(settings.planDaysPerWeek + 1, 1, 7),
                  })
                }
              >
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.help}>周目标 = 各科目时长之和 × 计划天数，用于时长分。</Text>
          <View style={styles.row}>
            <Text style={styles.label}>打卡门槛（分钟）</Text>
            <View style={styles.stepper}>
              <Pressable
                style={styles.step}
                onPress={() =>
                  persistSettings({
                    ...settings,
                    checkinMinMinutes: clamp(settings.checkinMinMinutes - 1, 1, 180),
                  })
                }
              >
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.num}>{settings.checkinMinMinutes}</Text>
              <Pressable
                style={styles.step}
                onPress={() =>
                  persistSettings({
                    ...settings,
                    checkinMinMinutes: clamp(settings.checkinMinMinutes + 1, 1, 180),
                  })
                }
              >
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.help}>当天累计达到该时长才算打卡，计入稳定分和连击。</Text>
        </View>

        <Text style={styles.section}>账号同步</Text>
        <View style={styles.card}>
          {accountEmail ? (
            <>
              <Text style={styles.help}>已登录 · 自动同步到云端</Text>
              <Text style={styles.accountEmail}>{accountEmail}</Text>
              <Pressable onPress={onSignOut} style={styles.ghostBtn}>
                <Text style={styles.ghostText}>退出登录</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.help}>同一账号登录后，学习记录和配置会存到云上，换手机也能看。</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="邮箱"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="密码（至少 6 位）"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Pressable
                onPress={() => onSignIn(email, password)}
                disabled={syncBusy}
                style={[styles.primaryBtn, syncBusy && styles.disabledBtn]}
              >
                <Text style={styles.primaryText}>{syncBusy ? '请稍候…' : '登录并同步'}</Text>
              </Pressable>
              <Pressable
                onPress={() => onRegister(email, password)}
                disabled={syncBusy}
                style={styles.ghostBtn}
              >
                <Text style={styles.ghostText}>注册新账号</Text>
              </Pressable>
            </>
          )}
        </View>

        <Text style={styles.section}>闹钟</Text>
        <View style={[styles.card, styles.row]}>
          <Text style={styles.label}>倒计时结束响铃</Text>
          <Switch
            value={settings.soundOn}
            onValueChange={(soundOn) => persistSettings({ ...settings, soundOn })}
            trackColor={{ false: colors.dim, true: colors.accent }}
            thumbColor="#FFFFFF"
          />
        </View>
      </ScrollView>
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
  section: {
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
    color: colors.muted,
    fontSize: 13,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 10,
  },
  name: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  label: {
    color: colors.ink,
    fontSize: 15,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  step: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    color: colors.ink,
    fontSize: 18,
  },
  num: {
    width: 44,
    textAlign: 'center',
    color: colors.ink,
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  link: {
    color: colors.accent,
    fontSize: 14,
  },
  disabled: {
    color: colors.dim,
  },
  danger: {
    color: colors.danger,
  },
  help: {
    marginTop: 6,
    marginBottom: 8,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  add: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.endBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  addPressed: {
    backgroundColor: colors.line,
  },
  addText: {
    color: colors.muted,
    fontSize: 15,
  },
  accountEmail: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 8,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    color: colors.ink,
    fontSize: 16,
  },
  primaryBtn: {
    marginTop: 14,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  ghostBtn: {
    marginTop: 10,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.endBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    color: colors.muted,
    fontSize: 15,
  },
  disabledBtn: {
    opacity: 0.55,
  },
});
