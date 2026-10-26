import React from 'react';
import { Pressable, View } from 'react-native';
import { NOTE_COLORS, useTheme } from '@/theme';
import { haptic } from '@/services/haptics';
import { useData } from '@/store/data';
import { useT } from '@/i18n';
import { Icon, Sheet, Sticker, T, Divider } from '@/components/ui';
import type { NoteColor } from '@/types';

/** One tappable row inside an action sheet. */
export function ActionRow({
  icon,
  label,
  onPress,
  danger,
  value,
  hint,
  last,
  selected,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
  value?: string;
  hint?: string;
  last?: boolean;
  selected?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          haptic('light');
          onPress();
        }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, opacity: pressed ? 0.6 : 1 })}
      >
        <Sticker icon={icon} bg={danger ? c.danger : c.primary} size={38} color={danger ? '#fff' : '#111'} />
        <View style={{ flex: 1 }}>
          <T variant="bodyBold" color={danger ? c.danger : c.ink}>
            {label}
          </T>
          {hint ? (
            <T variant="small" muted>
              {hint}
            </T>
          ) : null}
        </View>
        {value ? (
          <T variant="small" muted>
            {value}
          </T>
        ) : null}
        {selected ? <Icon name="check-bold" size={22} color={c.ink} /> : null}
      </Pressable>
      {last ? null : <Divider inset={52} />}
    </View>
  );
}

export function ColorDots({ value, onChange }: { value: NoteColor; onChange: (c: NoteColor) => void }) {
  const { c, isDark } = useTheme();
  const keys = Object.keys(NOTE_COLORS) as NoteColor[];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {keys.map((k) => {
        const bg = isDark ? NOTE_COLORS[k].dark : NOTE_COLORS[k].light;
        const on = k === value;
        return (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityLabel={k}
            accessibilityState={{ selected: on }}
            onPress={() => {
              haptic('select');
              onChange(k);
            }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: bg,
              borderWidth: on ? 4 : 2.5,
              borderColor: c.line,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {k === 'none' ? <Icon name="close" size={20} color={isDark ? c.ink : '#111'} /> : on ? <Icon name="check-bold" size={20} color={isDark ? c.ink : '#111'} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Bottom sheet for choosing a category (or none). */
export function CategorySheet({
  visible,
  onClose,
  value,
  onSelect,
  allowNone = true,
}: {
  visible: boolean;
  onClose: () => void;
  value: string | null;
  onSelect: (id: string | null) => void;
  allowNone?: boolean;
}) {
  const t = useT();
  const cats = useData((s) => s.categories);
  return (
    <Sheet visible={visible} onClose={onClose} title={t('Move to category')}>
      {allowNone ? (
        <ActionRow
          icon="folder-outline"
          label={t('No category')}
          selected={value === null}
          onPress={() => {
            onSelect(null);
            onClose();
          }}
        />
      ) : null}
      {cats.map((c, i) => (
        <ActionRow
          key={c.id}
          icon={c.icon}
          label={c.name}
          selected={value === c.id}
          last={i === cats.length - 1}
          onPress={() => {
            onSelect(c.id);
            onClose();
          }}
        />
      ))}
    </Sheet>
  );
}
