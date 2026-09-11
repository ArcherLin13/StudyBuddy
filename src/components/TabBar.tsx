import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export type TabKey = 'timer' | 'config' | 'history';

const TABS: { key: TabKey; label: string; icon: number; active: number }[] = [
  {
    key: 'config',
    label: '配置',
    icon: require('../../wechat/assets/icons/config.png'),
    active: require('../../wechat/assets/icons/config-active.png'),
  },
  {
    key: 'timer',
    label: '计时',
    icon: require('../../wechat/assets/icons/timer.png'),
    active: require('../../wechat/assets/icons/timer-active.png'),
  },
  {
    key: 'history',
    label: '历史',
    icon: require('../../wechat/assets/icons/history.png'),
    active: require('../../wechat/assets/icons/history-active.png'),
  },
];

type Props = {
  current: TabKey;
  onChange: (key: TabKey) => void;
};

export function TabBar({ current, onChange }: Props) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const selected = current === tab.key;
        return (
          <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={styles.item}>
            <Image source={selected ? tab.active : tab.icon} style={styles.icon} />
            <Text style={[styles.label, selected && styles.labelOn]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8E4DC',
    paddingTop: 6,
    paddingBottom: 4,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 26,
    height: 26,
    marginBottom: 2,
  },
  label: {
    fontSize: 10,
    color: colors.muted,
  },
  labelOn: {
    color: colors.ink,
    fontWeight: '600',
  },
});
