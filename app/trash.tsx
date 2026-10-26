import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { useData } from '@/store/data';
import { useSettings } from '@/store/settings';
import { toast } from '@/store/ui';
import { useT } from '@/i18n';
import { removeUnreferenced } from '@/services/media';
import { daysLeft } from '@/utils/date';
import { Brutal, Button, Dialog, EmptyState, Icon, IconButton, Screen, Sheet, T } from '@/components/ui';
import { NoteCard } from '@/components/notes/NoteCard';
import { RichText } from '@/components/notes/RichText';
import type { Note } from '@/types';

export default function Trash() {
  const t = useT();
  const { c } = useTheme();
  const notes = useData((s) => s.notes);
  const days = useSettings((s) => s.trashRetentionDays);
  const [target, setTarget] = useState<Note | null>(null);
  const [emptyOpen, setEmptyOpen] = useState(false);
  const [view, setView] = useState<Note | null>(null);

  const trashed = useMemo(() => notes.filter((n) => n.deletedAt !== null).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)), [notes]);

  const deleteForever = (n: Note) => {
    const gone = useData.getState().deleteNoteForever(n.id);
    if (gone) removeUnreferenced(gone.attachments.map((a) => a.uri));
    setTarget(null);
    router.push('/status/note-purged');
  };

  const emptyAll = () => {
    const gone = useData.getState().emptyTrash();
    gone.forEach((n) => removeUnreferenced(n.attachments.map((a) => a.uri)));
    setEmptyOpen(false);
    toast.success(t('Trash emptied'));
  };

  return (
    <Screen
      header={{
        title: t('Trash'),
        subtitle: t(trashed.length === 1 ? '{n} note' : '{n} notes', { n: trashed.length }),
        right: trashed.length ? <IconButton icon="delete-sweep-outline" label={t('Empty Trash')} onPress={() => setEmptyOpen(true)} /> : undefined,
      }}
    >
      {trashed.length === 0 ? (
        <EmptyState icon="delete-empty-outline" title={t('Trash is empty')} message={days > 0 ? t('Deleted notes stay here for {n} days before they’re removed for good.', { n: days }) : t('Deleted notes stay here until you empty the Trash.')} />
      ) : (
        <View style={{ gap: 18 }}>
          <Brutal bg={c.surface2} depth={2} radius={14} border={2} contentStyle={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12 }}>
            <Icon name="timer-sand" size={22} color={c.ink} />
            <T variant="small" style={{ flex: 1 }}>
              {days > 0 ? t('Notes are deleted forever {n} days after they’re moved here.', { n: days }) : t('Notes stay here until you delete them.')}
            </T>
          </Brutal>
          {trashed.map((n) => (
            <View key={n.id} style={{ gap: 10 }}>
              <NoteCard note={n} onPress={() => setView(n)} subtitle={days > 0 ? t('{n} days left', { n: daysLeft(n.deletedAt ?? Date.now(), days) }) : undefined} />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Button
                  small
                  style={{ flex: 1 }}
                  label={t('Restore')}
                  icon="restore"
                  onPress={() => {
                    useData.getState().restoreNote(n.id);
                    router.push(`/status/note-restored?id=${n.id}`);
                  }}
                />
                <Button small kind="danger" style={{ flex: 1 }} label={t('Delete forever')} icon="delete-forever-outline" onPress={() => setTarget(n)} />
              </View>
            </View>
          ))}
        </View>
      )}

      <Sheet visible={!!view} onClose={() => setView(null)} title={view?.title.trim() || t('Untitled note')}>
        {view ? (view.locked ? <T variant="body" muted>{t('Locked note · restore it to read')}</T> : <RichText body={view.body} />) : null}
      </Sheet>

      <Dialog
        visible={!!target}
        icon="delete-forever-outline"
        danger
        title={t('Delete note forever?')}
        message={t('“{name}” will be permanently deleted. This can’t be undone.', { name: target?.title.trim() || t('Untitled note') })}
        confirmLabel={t('Delete forever')}
        onConfirm={() => target && deleteForever(target)}
        onCancel={() => setTarget(null)}
      />
      <Dialog
        visible={emptyOpen}
        icon="delete-sweep-outline"
        danger
        title={t('Empty Trash?')}
        message={t('{n} notes will be permanently deleted.', { n: trashed.length })}
        confirmLabel={t('Empty Trash')}
        onConfirm={emptyAll}
        onCancel={() => setEmptyOpen(false)}
      />
    </Screen>
  );
}
