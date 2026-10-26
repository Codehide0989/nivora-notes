import React, { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { useData } from '@/store/data';
import { toast } from '@/store/ui';
import { useT } from '@/i18n';
import { startOfDay } from '@/utils/date';
import { Brutal, EmptyState, Field, Icon, IconButton, ProgressBar, Segmented, T } from '@/components/ui';
import { OfflineBanner } from '@/components/app/Banners';
import { TaskRow } from '@/components/app/Rows';
import { TAB_BAR_SPACE } from '@/components/app/TabBar';
import type { Priority, Task } from '@/types';

type Filter = 'all' | 'today' | 'high';
type Item = { k: 'h'; id: string; label: string; tone?: 'danger' } | { k: 't'; id: string; task: Task };

export default function Tasks() {
  const t = useT();
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const tasks = useData((s) => s.tasks);
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [filter, setFilter] = useState<Filter>('all');

  const open = useMemo(() => tasks.filter((x) => !x.done), [tasks]);
  const doneCount = tasks.length - open.length;
  const progress = tasks.length ? doneCount / tasks.length : 0;

  const items = useMemo<Item[]>(() => {
    const today = startOfDay(Date.now());
    let list = open;
    if (filter === 'today') list = list.filter((x) => x.dueAt !== null && startOfDay(x.dueAt) <= today);
    if (filter === 'high') list = list.filter((x) => x.priority === 'high');
    const by = (a: Task, b: Task) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || b.createdAt - a.createdAt;
    const overdue = list.filter((x) => x.dueAt !== null && x.dueAt < Date.now() && startOfDay(x.dueAt) < today).sort(by);
    const todayL = list.filter((x) => x.dueAt !== null && startOfDay(x.dueAt) === today).sort(by);
    const upcoming = list.filter((x) => x.dueAt !== null && startOfDay(x.dueAt) > today).sort(by);
    const someday = list.filter((x) => x.dueAt === null).sort(by);
    const out: Item[] = [];
    const add = (id: string, label: string, arr: Task[], tone?: 'danger') => {
      if (!arr.length) return;
      out.push({ k: 'h', id: `h-${id}`, label, tone });
      arr.forEach((task) => out.push({ k: 't', id: task.id, task }));
    };
    add('o', t('Overdue'), overdue, 'danger');
    add('t', t('Today'), todayL);
    add('u', t('Upcoming'), upcoming);
    add('s', t('No date'), someday);
    return out;
  }, [open, filter, t]);

  const add = () => {
    const title = text.trim();
    if (!title) return;
    useData.getState().addTask({ title, priority });
    setText('');
  };

  const toggle = (task: Task) => {
    useData.getState().toggleTask(task.id);
    if (!task.done)
      toast.show(t('Task completed'), { actionLabel: t('Undo'), onAction: () => useData.getState().toggleTask(task.id) });
  };

  const prio: Priority[] = ['low', 'medium', 'high'];
  const prioColor = (p: Priority) => (p === 'high' ? c.danger : p === 'medium' ? c.orange : c.success);

  const header = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10 }}>
        <View style={{ flex: 1 }}>
          <T variant="small" muted>
            {t('{a} of {b} done', { a: doneCount, b: tasks.length })}
          </T>
          <T variant="h1">{t('To-do lists')}</T>
        </View>
        <IconButton icon="check-all" label={t('Completed tasks')} onPress={() => router.push('/tasks-completed')} />
      </View>
      <View style={{ marginTop: 14 }}>
        <ProgressBar value={progress} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 16 }}>
        <Field
          boxStyle={{ flex: 1 }}
          value={text}
          onChangeText={setText}
          placeholder={t('Add a task…')}
          returnKeyType="done"
          onSubmitEditing={add}
          blurOnSubmit={false}
          icon="plus"
        />
        <View style={{ paddingTop: 0 }}>
          <Brutal
            bg={c.primary}
            depth={3}
            radius={14}
            onPress={add}
            accessibilityLabel={t('Add task')}
            contentStyle={{ width: 54, height: 54, alignItems: 'center', justifyContent: 'center', flexGrow: 0 }}
          >
            <Icon name="check-bold" size={26} color="#111" />
          </Brutal>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <T variant="label" muted>
          {t('Priority')}
        </T>
        {prio.map((p) => (
          <Brutal
            key={p}
            bg={priority === p ? prioColor(p) : c.surface}
            depth={priority === p ? 3 : 2}
            radius={999}
            border={2}
            quiet
            onPress={() => setPriority(p)}
            contentStyle={{ paddingHorizontal: 12, paddingVertical: 5, flexGrow: 0 }}
          >
            <T variant="label" fixed color={priority === p ? (p === 'high' ? '#fff' : '#111') : c.ink}>
              {t(p === 'high' ? 'High' : p === 'medium' ? 'Medium' : 'Low')}
            </T>
          </Brutal>
        ))}
      </View>
      <View style={{ marginTop: 16, marginBottom: 6 }}>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'all', label: t('All') },
            { key: 'today', label: t('Today') },
            { key: 'high', label: t('High') },
          ]}
        />
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OfflineBanner />
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: TAB_BAR_SPACE + insets.bottom, gap: 12 }}
        ListEmptyComponent={
          <EmptyState
            icon={tasks.length === 0 ? 'clipboard-check-outline' : 'party-popper'}
            title={tasks.length === 0 ? t('No tasks yet') : t('All clear!')}
            message={tasks.length === 0 ? t('Add your first task above and tick it off when it’s done.') : t('Nothing left to do here. Enjoy the free time.')}
            tone={tasks.length === 0 ? 'default' : 'success'}
          />
        }
        renderItem={({ item }) =>
          item.k === 'h' ? (
            <T variant="caps" color={item.tone === 'danger' ? c.danger : c.muted} style={{ marginTop: 8 }}>
              {item.label}
            </T>
          ) : (
            <TaskRow task={item.task} onToggle={() => toggle(item.task)} onPress={() => router.push(`/task/${item.task.id}`)} onLongPress={() => router.push(`/task/${item.task.id}`)} />
          )
        }
      />
      {doneCount > 0 ? (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: TAB_BAR_SPACE + insets.bottom - 8 }} pointerEvents="box-none" />
      ) : null}
    </View>
  );
}
