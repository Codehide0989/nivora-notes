import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/theme';
import { useData } from '@/store/data';
import { toast } from '@/store/ui';
import { useT } from '@/i18n';
import { isNoteUnlocked, markNoteUnlocked, requestUnlock } from '@/services/gate';
import { exportNote, ExportFormat, FORMAT_INFO, shareFile } from '@/services/export';
import { Brutal, Button, EmptyState, Icon, Screen, T, goBack } from '@/components/ui';

const ICONS: Record<ExportFormat, string> = { pdf: 'file-pdf-box', md: 'language-markdown-outline', txt: 'text-box-outline', html: 'file-code-outline' };
const HINTS: Record<ExportFormat, string> = {
  pdf: 'Best for printing and sending',
  md: 'Plain text with formatting marks',
  txt: 'Simple text, works everywhere',
  html: 'Opens in any web browser',
};

export default function ExportNote() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const { c } = useTheme();
  const note = useData((s) => s.notes.find((n) => n.id === id));
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [busy, setBusy] = useState(false);

  if (!note) {
    return (
      <Screen header={{ title: t('Export note') }}>
        <EmptyState icon="note-off-outline" title={t('Note not found')} message={t('It may have been deleted.')} actionLabel={t('Back')} onAction={() => goBack()} />
      </Screen>
    );
  }

  const run = async () => {
    if (note.locked && !isNoteUnlocked(note.id)) {
      if (!(await requestUnlock(t('Unlock to export this note')))) return;
      markNoteUnlocked(note.id);
    }
    setBusy(true);
    try {
      const uri = await exportNote(note, format);
      await shareFile(uri, format);
      useData.getState().logShare(note.id, 'export');
      router.replace(`/status/exported?noteId=${note.id}&format=${format}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Export failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={{ title: t('Export note'), subtitle: note.title.trim() || t('Untitled note') }}
      footer={<Button label={t('Export {fmt}', { fmt: FORMAT_INFO[format].ext.toUpperCase() })} icon="export-variant" onPress={() => void run()} loading={busy} />}
    >
      <T variant="caps" muted style={{ marginBottom: 12 }}>
        {t('Choose a format')}
      </T>
      <View style={{ gap: 14 }}>
        {(Object.keys(FORMAT_INFO) as ExportFormat[]).map((f) => {
          const on = f === format;
          return (
            <Brutal key={f} bg={on ? c.primary : c.surface} depth={on ? 5 : 3} radius={18} onPress={() => setFormat(f)} accessibilityLabel={FORMAT_INFO[f].label} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 }}>
              <Icon name={ICONS[f]} size={36} color={on ? '#111' : c.ink} />
              <View style={{ flex: 1 }}>
                <T variant="h3" color={on ? '#111' : c.ink}>
                  {t(FORMAT_INFO[f].label)} · .{FORMAT_INFO[f].ext}
                </T>
                <T variant="small" color={on ? '#111' : c.muted}>
                  {t(HINTS[f])}
                </T>
              </View>
              <Icon name={on ? 'radiobox-marked' : 'radiobox-blank'} size={26} color={on ? '#111' : c.muted} />
            </Brutal>
          );
        })}
      </View>
      <T variant="small" muted style={{ marginTop: 20 }}>
        {t('PDF and web page exports include your images. Voice recordings are not included.')}
      </T>
    </Screen>
  );
}
