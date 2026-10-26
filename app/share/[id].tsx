import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useData } from '@/store/data';
import { toast } from '@/store/ui';
import { useT } from '@/i18n';
import { isNoteUnlocked, requestUnlock, markNoteUnlocked } from '@/services/gate';
import { copyText, exportNote, ExportFormat, printNote, shareFile, shareText } from '@/services/export';
import { EmptyState, Icon, Screen, SectionLabel, SettingGroup, SettingRow, T, goBack } from '@/components/ui';
import { NoteCard } from '@/components/notes/NoteCard';

export default function ShareNote() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const note = useData((s) => s.notes.find((n) => n.id === id));
  const [busy, setBusy] = useState<string | null>(null);

  if (!note) {
    return (
      <Screen header={{ title: t('Share note') }}>
        <EmptyState icon="note-off-outline" title={t('Note not found')} message={t('It may have been deleted.')} actionLabel={t('Back')} onAction={() => goBack()} />
      </Screen>
    );
  }

  const guarded = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    if (note.locked && !isNoteUnlocked(note.id)) {
      if (!(await requestUnlock(t('Unlock to share this note')))) return;
      markNoteUnlocked(note.id);
    }
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Something went wrong'));
    } finally {
      setBusy(null);
    }
  };

  const asFile = (format: ExportFormat) => async () => {
    const uri = await exportNote(note, format);
    await shareFile(uri, format);
    useData.getState().logShare(note.id, 'file');
    router.replace(`/status/shared?noteId=${note.id}`);
  };

  const spinner = (k: string) => (busy === k ? <Icon name="loading" size={22} color="#111" /> : undefined);

  return (
    <Screen header={{ title: t('Share note') }}>
      <NoteCard note={note} onPress={() => router.push(`/note/${note.id}`)} subtitle={note.sharedAt ? t('Shared before') : undefined} />
      <SectionLabel>{t('Share as')}</SectionLabel>
      <SettingGroup>
        <SettingRow
          icon="message-text-outline"
          title={t('Text')}
          subtitle={t('Send through any app')}
          right={spinner('text')}
          onPress={() =>
            void guarded('text', async () => {
              if (await shareText(note)) router.replace(`/status/shared?noteId=${note.id}`);
            })
          }
        />
        <SettingRow icon="file-pdf-box" iconBg="#FF6B1A" title="PDF" subtitle={t('Formatted document with images')} right={spinner('pdf')} onPress={() => void guarded('pdf', asFile('pdf'))} />
        <SettingRow icon="language-markdown-outline" title="Markdown" subtitle={t('Keeps headings and checklists')} right={spinner('md')} onPress={() => void guarded('md', asFile('md'))} last />
      </SettingGroup>

      <SectionLabel>{t('More')}</SectionLabel>
      <SettingGroup>
        <SettingRow
          icon="content-copy"
          title={t('Copy to clipboard')}
          onPress={() =>
            void guarded('copy', async () => {
              await copyText(note);
              toast.success(t('Copied to clipboard'));
            })
          }
        />
        <SettingRow icon="printer-outline" iconBg="#FF6B1A" title={t('Print')} right={spinner('print')} onPress={() => void guarded('print', () => printNote(note))} />
        <SettingRow icon="export-variant" title={t('More export options')} onPress={() => router.replace(`/export/${note.id}`)} last />
      </SettingGroup>
      <T variant="small" muted center style={{ marginTop: 18 }}>
        {t('Nothing is uploaded. Notes are shared straight from your device.')}
      </T>
    </Screen>
  );
}
