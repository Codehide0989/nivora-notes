import React, { useMemo } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { NOTE_COLORS, useTheme } from '@/theme';
import { useData } from '@/store/data';
import { useSettings } from '@/store/settings';
import { useT } from '@/i18n';
import { sortNotes } from '@/utils/notes';
import { Brutal, EmptyState, Icon, IconButton, Screen, T } from '@/components/ui';
import { NoteCard } from '@/components/notes/NoteCard';
import { TaskRow } from '@/components/app/Rows';

export default function CategoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const { c, isDark } = useTheme();
  const cat = useData((s) => s.categories.find((x) => x.id === id));
  const notes = useData((s) => s.notes);
  const tasks = useData((s) => s.tasks);
  const sortBy = useSettings((s) => s.sortBy);

  const list = useMemo(() => sortNotes(notes.filter((n) => n.deletedAt === null && n.categoryId === id), sortBy), [notes, id, sortBy]);
  const openTasks = useMemo(() => tasks.filter((x) => !x.done && x.categoryId === id), [tasks, id]);

  if (!cat) return <Screen header={{ title: t('Category') }}><EmptyState icon="folder-off-outline" title={t('Category not found')} message={t('It may have been deleted.')} /></Screen>;
  const bg = isDark ? NOTE_COLORS[cat.color].dark : NOTE_COLORS[cat.color].light;

  const create = () => {
    const n = useData.getState().createNote({ categoryId: id });
    router.push(`/note/${n.id}?new=1`);
  };

  return (
    <Screen
      header={{ title: cat.name, subtitle: t(list.length === 1 ? '{n} note' : '{n} notes', { n: list.length }), right: <IconButton icon="plus" label={t('New note')} bg={c.primary} color="#111" onPress={create} /> }}
    >
      <Brutal bg={bg} depth={4} radius={20} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
        <Icon name={cat.icon} size={44} color={isDark ? c.ink : '#111'} />
        <View style={{ flex: 1 }}>
          <T variant="h2" color={isDark ? c.ink : '#111'}>
            {cat.name}
          </T>
          <T variant="small" color={isDark ? c.muted : '#333'}>
            {t('{a} notes · {b} open tasks', { a: list.length, b: openTasks.length })}
          </T>
        </View>
      </Brutal>

      {list.length === 0 && openTasks.length === 0 ? (
        <EmptyState icon="folder-open-outline" title={t('Nothing in here')} message={t('Notes you add to {name} will show up here.', { name: cat.name })} actionLabel={t('New note')} onAction={create} />
      ) : (
        <View style={{ gap: 14, marginTop: 18 }}>
          {list.map((n) => (
            <NoteCard key={n.id} note={n} onPress={() => router.push(`/note/${n.id}`)} />
          ))}
          {openTasks.length > 0 ? (
            <T variant="caps" muted style={{ marginTop: 6 }}>
              {t('Tasks')}
            </T>
          ) : null}
          {openTasks.map((x) => (
            <TaskRow key={x.id} task={x} onToggle={() => useData.getState().toggleTask(x.id)} onPress={() => router.push(`/task/${x.id}`)} />
          ))}
        </View>
      )}
    </Screen>
  );
}
