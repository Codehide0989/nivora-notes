import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { useT } from '@/i18n';
import { haptic } from '@/services/haptics';
import { useData } from '@/store/data';
import { formatDay, formatTime, startOfDay } from '@/utils/date';
import { Brutal, Icon, T } from '@/components/ui';
import type { Priority, Reminder, Task } from '@/types';

export function priorityColor(p: Priority, c: { danger: string; orange: string; success: string }): string {
  return p === 'high' ? c.danger : p === 'medium' ? c.orange : c.success;
}

export function CheckBox({ checked, onPress, size = 28, label }: { checked: boolean; onPress: () => void; size?: number; label?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={10}
      onPress={() => {
        haptic(checked ? 'light' : 'success');
        onPress();
      }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 3.4,
        borderWidth: 2.5,
        borderColor: c.line,
        backgroundColor: checked ? c.primary : c.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? <Icon name="check-bold" size={size * 0.64} color="#111" /> : null}
    </Pressable>
  );
}

export function dueLabel(ts: number, t: (s: string, v?: Record<string, string | number>) => string): string {
  const day = formatDay(ts);
  const label = day === 'Today' ? t('Today') : day === 'Tomorrow' ? t('Tomorrow') : day === 'Yesterday' ? t('Yesterday') : day;
  return `${label}, ${formatTime(ts)}`;
}

export function TaskRow({ task, onToggle, onPress, onLongPress }: { task: Task; onToggle: () => void; onPress: () => void; onLongPress?: () => void }) {
  const { c } = useTheme();
  const t = useT();
  const cat = useData((s) => s.categories.find((x) => x.id === task.categoryId));
  const overdue = !task.done && task.dueAt !== null && task.dueAt < Date.now();
  const subDone = task.subtasks.filter((s) => s.done).length;
  return (
    <Brutal depth={3} radius={16} onPress={onPress} onLongPress={onLongPress} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12 }}>
      <CheckBox checked={task.done} onPress={onToggle} label={task.title} />
      <View style={{ flex: 1, opacity: task.done ? 0.55 : 1 }}>
        <T variant="bodyBold" numberOfLines={2} style={task.done ? { textDecorationLine: 'line-through' } : undefined}>
          {task.title || t('Untitled task')}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
          {task.dueAt !== null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="calendar-clock" size={14} color={overdue ? c.danger : c.muted} />
              <T variant="label" fixed color={overdue ? c.danger : c.muted}>
                {dueLabel(task.dueAt, t)}
              </T>
            </View>
          ) : null}
          {task.subtasks.length > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="format-list-checks" size={14} color={c.muted} />
              <T variant="label" fixed muted>
                {subDone}/{task.subtasks.length}
              </T>
            </View>
          ) : null}
          {cat ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name={cat.icon} size={14} color={c.muted} />
              <T variant="label" fixed muted>
                {cat.name}
              </T>
            </View>
          ) : null}
        </View>
      </View>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: priorityColor(task.priority, c), borderWidth: 2, borderColor: c.line }} accessibilityLabel={`${task.priority} priority`} />
    </Brutal>
  );
}

export function repeatLabel(r: Reminder['repeat'], t: (s: string) => string): string {
  return r === 'daily' ? t('Every day') : r === 'weekly' ? t('Every week') : r === 'monthly' ? t('Every month') : t('Once');
}

export function ReminderRow({ reminder, onPress, onToggle }: { reminder: Reminder; onPress: () => void; onToggle: () => void }) {
  const { c } = useTheme();
  const t = useT();
  const note = useData((s) => (reminder.noteId ? s.notes.find((n) => n.id === reminder.noteId) : undefined));
  const overdue = !reminder.done && reminder.repeat === 'none' && reminder.at < Date.now();
  const d = new Date(reminder.at);
  const sameDay = startOfDay(Date.now()) === startOfDay(reminder.at);
  return (
    <Brutal depth={3} radius={16} onPress={onPress} bg={overdue ? c.surface2 : c.surface} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
      <View
        style={{
          width: 62,
          paddingVertical: 8,
          borderRadius: 12,
          borderWidth: 2.5,
          borderColor: c.line,
          backgroundColor: reminder.done ? c.surface2 : overdue ? c.danger : c.primary,
          alignItems: 'center',
        }}
      >
        <T variant="h3" fixed color={overdue ? '#fff' : '#111'} style={{ fontSize: 15, lineHeight: 18 }}>
          {formatTime(reminder.at).replace(' ', '')}
        </T>
        <T variant="label" fixed color={overdue ? '#fff' : '#111'} style={{ fontSize: 10 }}>
          {sameDay ? t('Today') : `${d.getDate()}/${d.getMonth() + 1}`}
        </T>
      </View>
      <View style={{ flex: 1, opacity: reminder.done ? 0.55 : 1 }}>
        <T variant="bodyBold" numberOfLines={1} style={reminder.done ? { textDecorationLine: 'line-through' } : undefined}>
          {reminder.title || t('Reminder')}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
          {reminder.repeat !== 'none' ? <Icon name="repeat" size={14} color={c.muted} /> : null}
          <T variant="label" muted fixed numberOfLines={1}>
            {repeatLabel(reminder.repeat, t)}
            {note ? ` · ${note.title || t('Untitled note')}` : ''}
          </T>
        </View>
      </View>
      <CheckBox checked={reminder.done} onPress={onToggle} label={t('Mark done')} />
    </Brutal>
  );
}
