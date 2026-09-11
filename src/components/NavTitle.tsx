import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function NavTitle({ title }: { title: string }) {
  return (
    <View style={styles.bar}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  title: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '600',
  },
});
