import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { useData } from '@/store/data';
import { toast } from '@/store/ui';
import { useT } from '@/i18n';
import { pickImages, takePhoto } from '@/services/media';
import { getTemplates } from '@/services/templates';
import { Brutal, Icon, Screen, SectionLabel, Sticker, T } from '@/components/ui';
import type { NoteColor, NoteKind } from '@/types';

export default function NewNote() {
  const t = useT();
  const { c } = useTheme();

  const create = (partial: { title?: string; body?: string; kind?: NoteKind; categoryId?: string | null; color?: NoteColor }) => {
    const cats = useData.getState().categories;
    const categoryId = partial.categoryId && cats.some((x) => x.id === partial.categoryId) ? partial.categoryId : null;
    const n = useData.getState().createNote({ ...partial, categoryId });
    router.replace(`/note/${n.id}?new=1`);
  };

  const withPhotos = async (camera: boolean) => {
    const res = camera ? await takePhoto() : await pickImages();
    if (res.ok) {
      const n = useData.getState().createNote({ attachments: res.items });
      router.replace(`/note/${n.id}?new=1`);
    } else if (res.reason === 'denied') toast.error(t('Permission denied. Enable it in your device settings.'));
    else if (res.reason === 'error') toast.error(t('Could not open the picker'));
  };

  const quick = [
    { icon: 'note-text-outline', label: t('Blank note'), bg: c.primary, onPress: () => create({}) },
    { icon: 'checkbox-marked-outline', label: t('Checklist'), bg: c.orange, onPress: () => create({ kind: 'checklist', body: '- [ ] ' }) },
    { icon: 'microphone', label: t('Voice note'), bg: '#25D9A0', onPress: () => router.replace('/voice') },
    { icon: 'image-plus', label: t('Photo note'), bg: '#A8E0FF', onPress: () => void withPhotos(false) },
  ];

  return (
    <Screen header={{ title: t('Create new note'), back: true, onBack: () => router.back() }} bottomPad={40}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {quick.map((q) => (
          <Brutal key={q.label} bg={q.bg} depth={4} radius={20} style={{ width: '47.5%' }} onPress={q.onPress} accessibilityLabel={q.label} contentStyle={{ padding: 16, minHeight: 118, justifyContent: 'space-between' }}>
            <Icon name={q.icon} size={38} color="#111" />
            <T variant="h3" color="#111">
              {q.label}
            </T>
          </Brutal>
        ))}
      </View>

      <Brutal bg={c.surface} depth={3} radius={16} style={{ marginTop: 14 }} onPress={() => void withPhotos(true)} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
        <Sticker icon="camera" bg={c.primary} size={40} />
        <View style={{ flex: 1 }}>
          <T variant="bodyBold">{t('Scan with camera')}</T>
          <T variant="small" muted>
            {t('Take a photo and start a note')}
          </T>
        </View>
        <Icon name="chevron-right" size={22} color={c.muted} />
      </Brutal>

      <SectionLabel>{t('Start from a template')}</SectionLabel>
      <View style={{ gap: 12 }}>
        {getTemplates().map((tpl) => (
          <Brutal
            key={tpl.id}
            depth={3}
            radius={16}
            onPress={() => create({ title: tpl.title, body: tpl.body, kind: tpl.kind, categoryId: tpl.categoryId ?? null, color: tpl.color })}
            contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}
          >
            <Sticker icon={tpl.icon} bg={c.primary} size={44} />
            <View style={{ flex: 1 }}>
              <T variant="bodyBold">{tpl.name}</T>
              <T variant="small" muted numberOfLines={1}>
                {tpl.description}
              </T>
            </View>
            <Icon name="chevron-right" size={22} color={c.muted} />
          </Brutal>
        ))}
      </View>

      <SectionLabel>{t('Or create')}</SectionLabel>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <Brutal bg={c.surface} depth={3} radius={16} style={{ flex: 1 }} onPress={() => router.replace('/reminder/new')} contentStyle={{ padding: 14, gap: 6 }}>
          <Icon name="bell-plus-outline" size={26} color={c.ink} />
          <T variant="bodyBold">{t('Reminder')}</T>
        </Brutal>
        <Brutal bg={c.surface} depth={3} radius={16} style={{ flex: 1 }} onPress={() => router.replace('/(tabs)/tasks')} contentStyle={{ padding: 14, gap: 6 }}>
          <Icon name="clipboard-check-outline" size={26} color={c.ink} />
          <T variant="bodyBold">{t('Task')}</T>
        </Brutal>
      </View>
    </Screen>
  );
}
