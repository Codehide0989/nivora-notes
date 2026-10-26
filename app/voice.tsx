import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useData } from '@/store/data';
import { toast } from '@/store/ui';
import { useT } from '@/i18n';
import { Screen, goBack } from '@/components/ui';
import { Recorder, RecordedClip } from '@/components/app/Audio';

/** Standalone voice recorder. With ?noteId it attaches to that note, otherwise it creates a new voice note. */
export default function Voice() {
  const t = useT();
  const { noteId } = useLocalSearchParams<{ noteId?: string }>();

  const onSave = (clip: RecordedClip) => {
    const store = useData.getState();
    const att = { id: clip.id, type: 'audio' as const, uri: clip.uri, duration: clip.duration, name: 'Voice note' };
    if (noteId) {
      const n = store.notes.find((x) => x.id === noteId);
      if (n) {
        store.updateNote(noteId, { attachments: [...n.attachments, att] });
        toast.success(t('Recording added'));
        goBack();
        return;
      }
    }
    const stamp = new Date().toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    const n = store.createNote({ title: `${t('Voice note')} · ${stamp}`, kind: 'voice', attachments: [att] });
    router.replace(`/note/${n.id}?new=1`);
  };

  return (
    <Screen header={{ title: t('Voice note'), subtitle: t('Record up to as long as you like') , onBack: () => goBack() }} contentStyle={{ paddingTop: 30 }}>
      <Recorder onSave={onSave} onCancel={() => goBack()} saveLabel={noteId ? t('Add to note') : t('Save as note')} />
    </Screen>
  );
}
