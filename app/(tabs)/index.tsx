import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { useData } from '@/store/data';
import { useSettings, SortBy } from '@/store/settings';
import { toast } from '@/store/ui';
import { useT } from '@/i18n';
import { sortNotes } from '@/utils/notes';
import { startOfDay } from '@/utils/date';
import { Avatar, Brutal, Chip, ChipRow, Dialog, EmptyState, Icon, IconButton, Sheet, T } from '@/components/ui';
import { NoteCard } from '@/components/notes/NoteCard';
import { OfflineBanner } from '@/components/app/Banners';
import { ActionRow, CategorySheet } from '@/components/app/Pickers';
import { TAB_BAR_SPACE } from '@/components/app/TabBar';
import type { Note } from '@/types';

type Row =
  | { k: 'h'; id: string; label: string }
  | { k: 'n'; id: string; note: Note }
  | { k: 'g'; id: string; a: Note; b?: Note };

function greeting(t: (s: string) => string): string {
  const h = new Date().getHours();
  if (h < 5) return t('Still up?');
  if (h < 12) return t('Good morning');
  if (h < 17) return t('Good afternoon');
  return t('Good evening');
}

export default function NotesHome() {
  const t = useT();
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const notes = useData((s) => s.notes);
  const categories = useData((s) => s.categories);
  const tasks = useData((s) => s.tasks);
  const reminders = useData((s) => s.reminders);
  const { profileName, noteView, sortBy, set } = useSettings();
  const [cat, setCat] = useState<string>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [sortOpen, setSortOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const live = useMemo(() => notes.filter((n) => n.deletedAt === null), [notes]);
  const filtered = useMemo(() => live.filter((n) => (cat === 'all' ? true : cat === 'none' ? !n.categoryId : n.categoryId === cat)), [live, cat]);
  const sorted = useMemo(() => sortNotes(filtered, sortBy), [filtered, sortBy]);
  const grid = noteView === 'grid';

  const stats = useMemo(() => {
    const today = startOfDay(Date.now());
    return {
      notes: live.length,
      tasks: tasks.filter((x) => !x.done).length,
      today: reminders.filter((r) => !r.done && startOfDay(r.at) === today).length,
    };
  }, [live, tasks, reminders]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const push = (list: Note[], prefix: string) => {
      if (grid) {
        for (let i = 0; i < list.length; i += 2) out.push({ k: 'g', id: `${prefix}${list[i].id}`, a: list[i], b: list[i + 1] });
      } else list.forEach((n) => out.push({ k: 'n', id: `${prefix}${n.id}`, note: n }));
    };
    const pinned = sorted.filter((n) => n.pinned);
    const rest = sorted.filter((n) => !n.pinned);
    if (pinned.length) {
      out.push({ k: 'h', id: 'h-pinned', label: t('Pinned') });
      push(pinned, 'p-');
    }
    if (rest.length) {
      if (pinned.length) out.push({ k: 'h', id: 'h-all', label: t('All notes') });
      push(rest, 'r-');
    }
    return out;
  }, [sorted, grid, t]);

  const selecting = selected.length > 0;
  const toggleSel = useCallback((id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])), []);
  const open = useCallback(
    (n: Note) => {
      if (selecting) toggleSel(n.id);
      else router.push(`/note/${n.id}`);
    },
    [selecting, toggleSel],
  );

  const card = (n: Note) => (
    <NoteCard
      key={n.id}
      note={n}
      grid={grid}
      onPress={() => open(n)}
      onLongPress={() => toggleSel(n.id)}
      right={
        selecting ? (
          <Icon name={selected.includes(n.id) ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={n.color === 'none' ? c.ink : '#111'} />
        ) : undefined
      }
    />
  );

  const bulkPin = () => {
    const picked = live.filter((n) => selected.includes(n.id));
    const pin = picked.some((n) => !n.pinned);
    picked.forEach((n) => {
      if (n.pinned !== pin) useData.getState().togglePin(n.id);
    });
    setSelected([]);
    toast.success(pin ? t('Pinned') : t('Unpinned'));
  };

  const bulkTrash = () => {
    const ids = [...selected];
    ids.forEach((id) => useData.getState().trashNote(id));
    setSelected([]);
    setConfirmDelete(false);
    toast.show(ids.length === 1 ? t('Note moved to Trash') : t('{n} notes moved to Trash', { n: ids.length }), {
      actionLabel: t('Undo'),
      onAction: () => ids.forEach((id) => useData.getState().restoreNote(id)),
    });
  };

  const header = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10 }}>
        <Avatar name={profileName || 'N'} size={46} />
        <View style={{ flex: 1 }}>
          <T variant="small" muted numberOfLines={1}>
            {greeting(t)}
            {profileName ? `, ${profileName.split(' ')[0]}` : ''}
          </T>
          <T variant="h1" numberOfLines={1}>
            {t('My notes')}
          </T>
        </View>
        <IconButton icon="magnify" label={t('Search')} onPress={() => router.push('/search')} />
        <IconButton icon="folder-outline" label={t('Categories')} onPress={() => router.push('/categories')} />
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        {[
          { v: stats.notes, l: t('Notes'), bg: c.primary, onPress: undefined as (() => void) | undefined },
          { v: stats.tasks, l: t('Open tasks'), bg: c.orange, onPress: () => router.push('/(tabs)/tasks') },
          { v: stats.today, l: t('Due today'), bg: c.surface, onPress: () => router.push('/(tabs)/reminders') },
        ].map((s) => (
          <Brutal key={s.l} bg={s.bg} depth={3} radius={14} border={2.5} style={{ flex: 1 }} onPress={s.onPress} quiet contentStyle={{ paddingVertical: 10, paddingHorizontal: 12 }}>
            <T variant="h1" fixed color="#111" style={{ fontSize: 24, lineHeight: 28 }}>
              {s.v}
            </T>
            <T variant="label" fixed color="#111" numberOfLines={1} style={{ opacity: 0.75 }}>
              {s.l}
            </T>
          </Brutal>
        ))}
      </View>

      <View style={{ marginTop: 16 }}>
        <ChipRow>
          <Chip label={t('All')} selected={cat === 'all'} onPress={() => setCat('all')} />
          {categories.map((x) => (
            <Chip key={x.id} label={x.name} icon={x.icon} selected={cat === x.id} onPress={() => setCat(x.id)} />
          ))}
          {live.some((n) => !n.categoryId) ? <Chip label={t('Uncategorised')} icon="folder-outline" selected={cat === 'none'} onPress={() => setCat('none')} /> : null}
        </ChipRow>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 4 }}>
        <T variant="caps" muted>
          {t(sorted.length === 1 ? '{n} note' : '{n} notes', { n: sorted.length })}
        </T>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <IconButton icon="sort-variant" label={t('Sort')} size={38} depth={2} onPress={() => setSortOpen(true)} />
          <IconButton icon={grid ? 'view-agenda-outline' : 'view-grid-outline'} label={grid ? t('List view') : t('Grid view')} size={38} depth={2} onPress={() => set({ noteView: grid ? 'list' : 'grid' })} />
        </View>
      </View>
    </View>
  );

  const empty =
    live.length === 0 ? (
      <EmptyState
        icon="note-plus-outline"
        title={t('No notes yet!')}
        message={t('Tap the + button to write your first note, checklist or voice memo.')}
        actionLabel={t('Create your first note')}
        onAction={() => router.push('/new')}
      />
    ) : (
      <EmptyState icon="folder-open-outline" title={t('Nothing in here')} message={t('No notes in this category yet.')} actionLabel={t('New note')} onAction={() => router.push('/new')} />
    );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {selecting ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 }}>
          <Brutal bg={c.primary} depth={4} radius={18} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 }}>
            <IconButton icon="close" label={t('Cancel')} size={40} depth={2} onPress={() => setSelected([])} />
            <T variant="h2" color="#111" style={{ flex: 1 }}>
              {t('{n} selected', { n: selected.length })}
            </T>
            <IconButton icon="select-all" label={t('Select all')} size={40} depth={2} onPress={() => setSelected(sorted.map((n) => n.id))} />
            <IconButton icon="pin-outline" label={t('Pin')} size={40} depth={2} onPress={bulkPin} />
            <IconButton icon="folder-move-outline" label={t('Move to category')} size={40} depth={2} onPress={() => setMoveOpen(true)} />
            <IconButton icon="delete-outline" label={t('Delete')} size={40} depth={2} bg={c.danger} color="#fff" onPress={() => setConfirmDelete(true)} />
          </Brutal>
        </View>
      ) : null}
      {!selecting ? <OfflineBanner /> : null}
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={selecting ? null : header}
        ListEmptyComponent={empty}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: TAB_BAR_SPACE + insets.bottom, gap: 14 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          if (item.k === 'h')
            return (
              <T variant="caps" muted style={{ marginTop: 6 }}>
                {item.label}
              </T>
            );
          if (item.k === 'n') return card(item.note);
          return (
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'stretch' }}>
              <View style={{ flex: 1 }}>{card(item.a)}</View>
              <View style={{ flex: 1 }}>{item.b ? card(item.b) : null}</View>
            </View>
          );
        }}
      />

      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title={t('Sort notes')}>
        {(
          [
            ['updated', t('Last edited'), 'clock-outline'],
            ['created', t('Date created'), 'calendar-plus'],
            ['title', t('Title (A–Z)'), 'sort-alphabetical-ascending'],
          ] as [SortBy, string, string][]
        ).map(([k, label, icon], i) => (
          <ActionRow
            key={k}
            icon={icon}
            label={label}
            selected={sortBy === k}
            last={i === 2}
            onPress={() => {
              set({ sortBy: k });
              setSortOpen(false);
            }}
          />
        ))}
      </Sheet>

      <CategorySheet
        visible={moveOpen}
        onClose={() => setMoveOpen(false)}
        value={null}
        onSelect={(id) => {
          selected.forEach((nid) => useData.getState().updateNote(nid, { categoryId: id }));
          toast.success(t('Moved {n} notes', { n: selected.length }));
          setSelected([]);
        }}
      />

      <Dialog
        visible={confirmDelete}
        icon="delete-outline"
        danger
        title={t('Move to Trash?')}
        message={t('You can restore these notes from Trash for the next {n} days.', { n: useSettings.getState().trashRetentionDays })}
        confirmLabel={t('Move to Trash')}
        onConfirm={bulkTrash}
        onCancel={() => setConfirmDelete(false)}
      />
    </View>
  );
}
