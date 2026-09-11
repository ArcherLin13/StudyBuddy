import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NavTitle } from '../components/NavTitle';
import { PlayButton } from '../components/PlayButton';
import type { TimerView } from '../hooks/useStudyTimer';
import { colors } from '../theme';

type Props = {
  view: TimerView;
  onMain: () => void;
  onEnd: () => void;
};

export function HomeScreen({ view, onMain, onEnd }: Props) {
  return (
    <View style={styles.root}>
      <NavTitle title="计时" />
      <View style={styles.stage}>
        <Text style={styles.hint}>{view.hint}</Text>
        <Text style={styles.subject}>{view.subjectName}</Text>
        <Text style={styles.time}>{view.timeText}</Text>
        <View style={styles.btnWrap}>
          <PlayButton mode={view.btnMode} onPress={onMain} />
        </View>
      </View>
      {view.showEnd ? (
        <Pressable onPress={onEnd} style={({ pressed }) => [styles.endBtn, pressed && styles.endPressed]}>
          <Text style={styles.endText}>结束</Text>
        </Pressable>
      ) : (
        <View style={styles.endPlaceholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 24,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    letterSpacing: 3,
  },
  subject: {
    marginTop: 8,
    color: colors.ink,
    fontSize: 22,
    fontWeight: '600',
  },
  time: {
    marginTop: 16,
    color: colors.ink,
    fontSize: 64,
    fontWeight: '500',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  btnWrap: {
    marginTop: 40,
  },
  endBtn: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.endBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  endPressed: {
    backgroundColor: colors.line,
  },
  endText: {
    color: colors.muted,
    fontSize: 15,
  },
  endPlaceholder: {
    height: 56,
  },
});
