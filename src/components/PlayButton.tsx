import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  mode: 'play' | 'pause' | 'resume';
  onPress: () => void;
};

export function PlayButton({ mode, onPress }: Props) {
  const running = mode === 'pause';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={running ? '暂停' : '开始'}
      onPress={onPress}
      style={({ pressed }) => [styles.outer, running && styles.outerRunning, pressed && styles.pressed]}
    >
      {running ? (
        <View style={styles.pause}>
          <View style={styles.bar} />
          <View style={styles.bar} />
        </View>
      ) : (
        <View style={styles.triangle} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  outerRunning: {
    backgroundColor: colors.ink,
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
  },
  pressed: {
    opacity: 0.88,
  },
  triangle: {
    width: 0,
    height: 0,
    marginLeft: 5,
    borderTopWidth: 14,
    borderBottomWidth: 14,
    borderLeftWidth: 24,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFFFFF',
  },
  pause: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bar: {
    width: 6,
    height: 24,
    marginHorizontal: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
});
