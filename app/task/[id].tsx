import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/theme';
import { useData } from '@/store/data';
import { toast } from '@/store/ui';
import { useT } from '@/i18n';
import { uid } from '@/utils/id';
import { Brutal, Button, Chip, EmptyState, Field, Icon, Screen, SectionLabel, Segmented, T, goBack } from '@/components/ui';
import { DateTimeSheet } from '@/components/app/DateTimeSheet';
import { CategorySheet } from '@/components/app/Pickers';
import { CheckBox, dueLabel } from '@/components/app/Rows';
import type { Priority } from '@/types';

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const { c } = useTheme();
  const task = useData((s) => s.tasks.find((x) => x.id === id));
  const cat = useData((s) => s.categories.find((x) => x.id === task?.categoryId));
  const update = useData((s) => s.updateTask);
  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [sub, setSub] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  useEffect(() => {
    if (!task) return;
    const h = setTimeout(() => {
      if (title !== task.title || notes !== task.notes) update(task.id, { title: title.trim() ? title : task.title, notes });
    }, 400);
    return () => clearTimeout(h);
  }, [title, notes]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) {
    return (
      <Screen header={{ title: t('Task') }}>
        <EmptyState icon="clipboard-off-outline" title={t('Task not found')} message={t('It may have been deleted.')} actionLabel={t('Back')} onAction={() => goBack('/(tabs)/tasks')} />
      </Screen>
    );
  }

  const addSub = () => {
    const v = sub.trim();
    if (!v) return;
    update(task.id, { subtasks: [...task.subtasks, { id: uid(), title: v, done: false }] });
    setSub('');
  };

  const remove = () => {
    const removed = useData.getState().deleteTask(task.id);
    goBack('/(tabs)/tasks');
    if (removed) toast.show(t('Task deleted'), { actionLabel: t('Undo'), onAction: () => useData.getState().restoreTask(removed) });
  };

  const prioOpts: { key: Priority; label: string }[] = [
    { key: 'low', label: t('Low') },
    { key: 'medium', label: t('Medium') },
    { key: 'high', label: t('High') },
  ];
  const overdue = !task.done && task.dueAt !== null && task.dueAt < Date.now();

  return (
    <Screen
      header={{ title: t('Task detail') }}
      footer={
        <Button
          label={task.done ? t('Mark as not done') : t('Mark complete')}
          icon={task.done ? 'restart' : 'check-bold'}
          kind={task.done ? 'light' : 'primary'}
          onPress={() => {
            useData.getState().toggleTask(task.id);
            if (!task.done) toast.success(t('Task completed'));
            goBack('/(tabs)/tasks');
          }}
        />
      }
    >
      <Field label={t('Task')} value={title} onChangeText={setTitle} placeholder={t('What needs doing?')} multiline style={{ minHeight: 60 }} />

      <SectionLabel>{t('Priority')}</SectionLabel>
      <Segmented<Priority> value={task.priority} onChange={(p) => update(task.id, { priority: p })} options={prioOpts} />

      <SectionLabel>{t('Due')}</SectionLabel>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Chip label={task.dueAt ? dueLabel(task.dueAt, t) : t('Set due date')} icon="calendar-clock" selected={!!task.dueAt} onPress={() => setDateOpen(true)} />
        {task.dueAt ? <Chip label={t('Clear')} icon="close" onPress={() => update(task.id, { dueAt: null })} /> : null}
        <Chip label={cat ? cat.name : t('Category')} icon={cat ? cat.icon : 'folder-outline'} onPress={() => setCatOpen(true)} />
      </View>
      {overdue ? (
        <T variant="small" color={c.danger} style={{ marginTop: 8 }}>
          {t('This task is overdue')}
        </T>
      ) : null}
      {task.dueAt ? (
        <Brutal bg={c.surface} depth={3} radius={14} style={{ marginTop: 14 }} onPress={() => router.push(`/reminder/new?title=${encodeURIComponent(title || task.title)}&at=${task.dueAt}`)} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
          <Icon name="bell-plus-outline" size={24} color={c.ink} />
          <T variant="bodyBold" style={{ flex: 1 }}>
            {t('Remind me when it’s due')}
          </T>
          <Icon name="chevron-right" size={22} color={c.muted} />
        </Brutal>
      ) : null}

      <SectionLabel>{t('Subtasks')}</SectionLabel>
      <View style={{ gap: 10 }}>
        {task.subtasks.map((s) => (
          <Brutal key={s.id} depth={2} radius={14} border={2} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}>
            <CheckBox
              size={26}
              checked={s.done}
              onPress={() => update(task.id, { subtasks: task.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })}
              label={s.title}
            />
            <T variant="body" style={[{ flex: 1 }, s.done ? { textDecorationLine: 'line-through', opacity: 0.55 } : undefined]}>
              {s.title}
            </T>
            <Pressable hitSlop={10} accessibilityLabel={t('Remove')} onPress={() => update(task.id, { subtasks: task.subtasks.filter((x) => x.id !== s.id) })}>
              <Icon name="close" size={20} color={c.muted} />
            </Pressable>
          </Brutal>
        ))}
        <Field value={sub} onChangeText={setSub} placeholder={t('Add a subtask')} icon="plus" returnKeyType="done" onSubmitEditing={addSub} blurOnSubmit={false} />
      </View>

      <SectionLabel>{t('Notes')}</SectionLabel>
      <Field value={notes} onChangeText={setNotes} placeholder={t('Add details…')} multiline />

      <View style={{ marginTop: 22 }}>
        <Button label={t('Delete task')} kind="light" icon="delete-outline" onPress={remove} />
      </View>

      <DateTimeSheet visible={dateOpen} value={task.dueAt} onClose={() => setDateOpen(false)} onConfirm={(ts) => update(task.id, { dueAt: ts })} onClear={task.dueAt ? () => update(task.id, { dueAt: null }) : undefined} title={t('Due date')} />
      <CategorySheet visible={catOpen} onClose={() => setCatOpen(false)} value={task.categoryId} onSelect={(cid) => update(task.id, { categoryId: cid })} />
    </Screen>
  );
}
