import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/theme';
import { useData } from '@/store/data';
import { useSettings } from '@/store/settings';
import { toast } from '@/store/ui';
import { useT } from '@/i18n';
import { cancelNotification, ensurePermission, scheduleReminder } from '@/services/notifications';
import { Brutal, Button, Chip, Dialog, EmptyState, Field, Icon, Screen, SectionLabel, Segmented, Sheet, T, goBack } from '@/components/ui';
import { DateTimeSheet } from '@/components/app/DateTimeSheet';
import { ActionRow } from '@/components/app/Pickers';
import { dueLabel } from '@/components/app/Rows';
import type { Repeat } from '@/types';

export default function ReminderEditor() {
  const { id, noteId: noteParam, title: titleParam, at: atParam } = useLocalSearchParams<{ id: string; noteId?: string; title?: string; at?: string }>();
  const isNew = id === 'new';
  const t = useT();
  const { c } = useTheme();
  const existing = useData((s) => s.reminders.find((r) => r.id === id));
  const notes = useData((s) => s.notes);

  const [title, setTitle] = useState(existing?.title ?? (titleParam ? String(titleParam) : ''));
  const [body, setBody] = useState(existing?.notes ?? '');
  const [at, setAt] = useState<number>(() => {
    if (existing) return existing.at;
    const fromParam = atParam ? Number(atParam) : NaN;
    if (!Number.isNaN(fromParam) && fromParam > Date.now()) return fromParam;
    const d = new Date(Date.now() + 3600_000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    return d.getTime();
  });
  const [repeat, setRepeat] = useState<Repeat>(existing?.repeat ?? 'none');
  const [noteId, setNoteId] = useState<string | null>(existing?.noteId ?? (noteParam ? String(noteParam) : null));
  const [dateOpen, setDateOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isNew && !existing) {
    return (
      <Screen header={{ title: t('Reminder') }}>
        <EmptyState icon="bell-off-outline" title={t('Reminder not found')} message={t('It may have been deleted.')} actionLabel={t('Back')} onAction={() => goBack('/(tabs)/reminders')} />
      </Screen>
    );
  }

  const linked = noteId ? notes.find((n) => n.id === noteId && n.deletedAt === null) : undefined;
  const past = repeat === 'none' && at < Date.now() - 30_000;

  const save = async () => {
    if (past) return toast.error(t('Pick a time in the future'));
    setBusy(true);
    const store = useData.getState();
    const data = { title: title.trim() || t('Reminder'), notes: body.trim(), at, repeat, noteId: linked ? linked.id : null, done: false };
    const rem = existing ? (store.updateReminder(existing.id, data), { ...existing, ...data }) : store.addReminder(data);
    let scheduled = true;
    try {
      const allowed = useSettings.getState().notificationsEnabled ? await ensurePermission() : false;
      if (!allowed) scheduled = false;
      const nid = await scheduleReminder(rem);
      store.updateReminder(rem.id, { notificationId: nid });
      if (!nid) scheduled = false;
    } catch {
      scheduled = false;
    }
    setBusy(false);
    if (scheduled) toast.success(existing ? t('Reminder updated') : t('Reminder set'));
    else toast.show(t('Saved, but notifications are off so it won’t alert you'), { actionLabel: t('Fix'), onAction: () => router.push('/prefs/notifications') });
    goBack('/(tabs)/reminders');
  };

  const remove = async () => {
    if (existing) {
      await cancelNotification(existing.notificationId);
      useData.getState().deleteReminder(existing.id);
    }
    setConfirmDelete(false);
    toast.success(t('Reminder deleted'));
    goBack('/(tabs)/reminders');
  };

  const repeatOpts: { key: Repeat; label: string }[] = [
    { key: 'none', label: t('Once') },
    { key: 'daily', label: t('Daily') },
    { key: 'weekly', label: t('Weekly') },
    { key: 'monthly', label: t('Monthly') },
  ];
  const recent = notes.filter((n) => n.deletedAt === null && !n.locked).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30);

  return (
    <Screen
      header={{ title: isNew ? t('Create reminder') : t('Edit reminder') }}
      footer={<Button label={isNew ? t('Set reminder') : t('Save changes')} icon="bell-ring-outline" onPress={() => void save()} loading={busy} />}
    >
      <Field label={t('What should we remind you about?')} value={title} onChangeText={setTitle} placeholder={t('e.g. Team meeting')} icon="bell-outline" maxLength={80} autoFocus={isNew && !titleParam} />

      <SectionLabel>{t('When')}</SectionLabel>
      <Brutal bg={c.primary} depth={4} radius={18} onPress={() => setDateOpen(true)} accessibilityLabel={t('Pick date & time')} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
        <Icon name="calendar-clock" size={34} color="#111" />
        <View style={{ flex: 1 }}>
          <T variant="h3" color="#111">
            {dueLabel(at, t)}
          </T>
          <T variant="small" color="#111" style={{ opacity: 0.7 }}>
            {new Date(at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </T>
        </View>
        <Icon name="pencil-outline" size={22} color="#111" />
      </Brutal>
      {past ? (
        <T variant="small" color={c.danger} style={{ marginTop: 8 }}>
          {t('That time has already passed')}
        </T>
      ) : null}

      <SectionLabel>{t('Repeat')}</SectionLabel>
      <Segmented<Repeat> value={repeat} onChange={setRepeat} options={repeatOpts} />

      <SectionLabel>{t('Details')}</SectionLabel>
      <Field value={body} onChangeText={setBody} placeholder={t('Add a note (optional)')} multiline />

      <SectionLabel>{t('Linked note')}</SectionLabel>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Chip label={linked ? linked.title || t('Untitled note') : t('Attach a note')} icon="note-text-outline" selected={!!linked} onPress={() => setNoteOpen(true)} />
        {linked ? <Chip label={t('Open')} icon="open-in-new" onPress={() => router.push(`/note/${linked.id}`)} /> : null}
        {linked ? <Chip label={t('Remove')} icon="close" onPress={() => setNoteId(null)} /> : null}
      </View>

      {existing ? (
        <View style={{ marginTop: 24 }}>
          <Button label={t('Delete reminder')} kind="light" icon="delete-outline" onPress={() => setConfirmDelete(true)} />
        </View>
      ) : null}

      <DateTimeSheet visible={dateOpen} value={at} onClose={() => setDateOpen(false)} onConfirm={setAt} minToday={repeat === 'none'} title={t('Remind me on')} />

      <Sheet visible={noteOpen} onClose={() => setNoteOpen(false)} title={t('Attach a note')}>
        {recent.length === 0 ? (
          <T variant="body" muted>
            {t('You have no notes yet.')}
          </T>
        ) : (
          recent.map((n, i) => (
            <ActionRow
              key={n.id}
              icon="note-text-outline"
              label={n.title.trim() || t('Untitled note')}
              selected={noteId === n.id}
              last={i === recent.length - 1}
              onPress={() => {
                setNoteId(n.id);
                setNoteOpen(false);
              }}
            />
          ))
        )}
      </Sheet>

      <Dialog visible={confirmDelete} icon="bell-remove-outline" danger title={t('Delete reminder?')} message={t('It will no longer alert you.')} confirmLabel={t('Delete')} onConfirm={() => void remove()} onCancel={() => setConfirmDelete(false)} />
    </Screen>
  );
}
