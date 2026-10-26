import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { useData } from '@/store/data';
import { useT } from '@/i18n';
import { relativeTime } from '@/utils/date';
import { checklistProgress, preview } from '@/utils/markdown';
import { Brutal, Icon, T } from '@/components/ui';
import type { Note } from '@/types';

interface Props {
  note: Note;
  grid?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  right?: React.ReactNode;
  subtitle?: string;
}

export function NoteCard({ note, grid, onPress, onLongPress, right, subtitle }: Props) {
  const { c, noteBg } = useTheme();
  const t = useT();
  const cat = useData((s) => s.categories.find((x) => x.id === note.categoryId));
  const bg = noteBg(note.color);
  const onColor = note.color !== 'none';
  const fg = onColor ? (bg.startsWith('#') && isLightHex(bg) ? '#111' : '#FFF8E1') : c.ink;
  const sub = onColor ? (isLightHex(bg) ? '#3b3a33' : '#E8E2C2') : c.muted;
  const progress = note.kind === 'checklist' || /- \[[ xX]\]/.test(note.body) ? checklistProgress(note.body) : null;
  const images = note.attachments.filter((a) => a.type === 'image');
  const audio = note.attachments.filter((a) => a.type === 'audio').length;
  const text = note.locked ? '' : preview(note.body, grid ? 5 : 3);

  return (
    <Brutal bg={bg} depth={4} radius={18} onPress={onPress} onLongPress={onLongPress} style={grid ? { flex: 1 } : undefined} contentStyle={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <T variant="h3" color={fg} numberOfLines={2}>
            {note.title.trim() || t('Untitled note')}
          </T>
        </View>
        {note.pinned ? <Icon name="pin" size={18} color={fg} /> : null}
        {note.locked ? <Icon name="lock" size={18} color={fg} /> : null}
        {right}
      </View>
      {note.locked ? (
        <T variant="small" color={sub} style={{ marginTop: 6 }}>
          {t('Locked note · unlock to read')}
        </T>
      ) : text ? (
        <T variant="small" color={sub} numberOfLines={grid ? 5 : 3} style={{ marginTop: 6 }}>
          {text}
        </T>
      ) : null}
      {!note.locked && images.length > 0 && !grid ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          {images.slice(0, 3).map((a) => (
            <ThumbImage key={a.id} uri={a.uri} />
          ))}
        </View>
      ) : null}
      {progress && progress.total > 0 ? (
        <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, height: 8, borderRadius: 4, borderWidth: 2, borderColor: fg, overflow: 'hidden' }}>
            <View style={{ width: `${(progress.done / progress.total) * 100}%`, height: '100%', backgroundColor: fg }} />
          </View>
          <T variant="label" color={fg} fixed>
            {progress.done}/{progress.total}
          </T>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        {cat ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name={cat.icon} size={14} color={sub} />
            <T variant="label" color={sub} fixed numberOfLines={1}>
              {cat.name}
            </T>
          </View>
        ) : null}
        {images.length > 0 ? <Icon name="image-outline" size={15} color={sub} /> : null}
        {audio > 0 ? <Icon name="microphone" size={15} color={sub} /> : null}
        <T variant="label" color={sub} fixed style={{ marginLeft: 'auto' }}>
          {subtitle ?? relativeTime(note.updatedAt)}
        </T>
      </View>
    </Brutal>
  );
}

function isLightHex(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

import { Image } from 'expo-image';
function ThumbImage({ uri }: { uri: string }) {
  const { c } = useTheme();
  return <Image source={{ uri }} style={{ width: 64, height: 64, borderRadius: 10, borderWidth: 2, borderColor: c.line, backgroundColor: c.surface2 }} contentFit="cover" />;
}
