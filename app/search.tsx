import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { FONTS, useTheme } from '@/theme';
import { useData } from '@/store/data';
import { useT } from '@/i18n';
import { highlight, scoreNote, snippetAround } from '@/utils/notes';
import { toPlain } from '@/utils/markdown';
import { Brutal, Chip, ChipRow, EmptyState, Field, Icon, Screen, SectionLabel, T } from '@/components/ui';
import { CheckBox } from '@/components/app/Rows';
import type { Note } from '@/types';

const RECENT_KEY = 'nivora.recentSearches';

function Marked({ text, query, style }: { text: string; query: string; style?: object }) {
  return (
    <Text style={style}>
      {highlight(text, query).map((p, i) => (
        <Text key={i} style={p.hit ? { backgroundColor: '#FFE45C', color: '#111', fontFamily: FONTS.bold } : undefined}>
          {p.text}
        </Text>
      ))}
    </Text>
  );
}

export default function Search() {
  const t = useT();
  const { c, fs } = useTheme();
  const notes = useData((s) => s.notes);
  const tasks = useData((s) => s.tasks);
  const categories = useData((s) => s.categories);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [onlyMedia, setOnlyMedia] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY)
      .then((v) => v && setRecent(JSON.parse(v)))
      .catch(() => undefined);
  }, []);

  const remember = useCallback((term: string) => {
    const v = term.trim();
    if (v.length < 2) return;
    setRecent((r) => {
      const next = [v, ...r.filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 8);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const clearRecent = () => {
    setRecent([]);
    AsyncStorage.removeItem(RECENT_KEY).catch(() => undefined);
  };

  const query = q.trim();
  const noteHits = useMemo(() => {
    if (!query && !cat && !onlyMedia) return [] as { n: Note; s: number }[];
    return notes
      .filter((n) => n.deletedAt === null)
      .filter((n) => (cat ? n.categoryId === cat : true))
      .filter((n) => (onlyMedia ? n.attachments.length > 0 : true))
      .map((n) => ({ n, s: query ? scoreNote(n, query) : 1 }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || b.n.updatedAt - a.n.updatedAt);
  }, [notes, query, cat, onlyMedia]);

  const taskHits = useMemo(() => {
    if (!query || cat || onlyMedia) return [];
    const words = query.toLowerCase().split(/\s+/);
    return tasks.filter((x) => words.every((w) => `${x.title} ${x.notes}`.toLowerCase().includes(w)));
  }, [tasks, query, cat, onlyMedia]);

  const searching = query.length > 0 || !!cat || onlyMedia;
  const total = noteHits.length + taskHits.length;

  return (
    <Screen header={{ title: t('Search') }} scroll={false} keyboard>
      <Field
        value={q}
        onChangeText={setQ}
        autoFocus
        placeholder={t('Search notes, tasks, tags…')}
        icon="magnify"
        returnKeyType="search"
        onSubmitEditing={() => remember(q)}
        right={
          q ? (
            <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityLabel={t('Clear')}>
              <Icon name="close-circle" size={22} color={c.muted} />
            </Pressable>
          ) : undefined
        }
      />
      <View style={{ marginTop: 12 }}>
        <ChipRow>
          <Chip label={t('With media')} icon="image-outline" selected={onlyMedia} onPress={() => setOnlyMedia(!onlyMedia)} />
          {categories.map((x) => (
            <Chip key={x.id} label={x.name} icon={x.icon} selected={cat === x.id} onPress={() => setCat(cat === x.id ? null : x.id)} />
          ))}
        </ChipRow>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {!searching ? (
          recent.length > 0 ? (
            <View>
              <SectionLabel
                right={
                  <Pressable onPress={clearRecent} hitSlop={10}>
                    <T variant="label" color={c.danger}>
                      {t('Clear')}
                    </T>
                  </Pressable>
                }
              >
                {t('Recent searches')}
              </SectionLabel>
              {recent.map((r) => (
                <Pressable key={r} onPress={() => setQ(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
                  <Icon name="history" size={20} color={c.muted} />
                  <T variant="body" style={{ flex: 1 }}>
                    {r}
                  </T>
                  <Icon name="arrow-top-left" size={18} color={c.muted} />
                </Pressable>
              ))}
            </View>
          ) : (
            <EmptyState icon="text-search" title={t('Find anything')} message={t('Search titles, note text, tags and tasks. Locked notes only match by title.')} />
          )
        ) : total === 0 ? (
          <EmptyState
            icon="magnify-close"
            title={t('No search results')}
            message={query ? t('We couldn’t find anything for “{q}”. Try a different word or check the spelling.', { q: query }) : t('No notes match these filters.')}
            actionLabel={query ? t('Create a note with this title') : undefined}
            onAction={() => {
              const n = useData.getState().createNote({ title: query });
              router.replace(`/note/${n.id}?new=1`);
            }}
            secondaryLabel={cat || onlyMedia ? t('Clear filters') : undefined}
            onSecondary={() => {
              setCat(null);
              setOnlyMedia(false);
            }}
          />
        ) : (
          <View style={{ gap: 12, marginTop: 8 }}>
            <T variant="caps" muted>
              {t(total === 1 ? '{n} result' : '{n} results', { n: total })}
            </T>
            {noteHits.map(({ n }) => {
              const body = n.locked ? t('Locked note · unlock to read') : toPlain(n.body);
              const snip = n.locked ? body : snippetAround(body, query);
              const cat2 = categories.find((x) => x.id === n.categoryId);
              return (
                <Brutal
                  key={n.id}
                  depth={3}
                  radius={16}
                  onPress={() => {
                    remember(q);
                    router.push(`/note/${n.id}`);
                  }}
                  contentStyle={{ padding: 14, gap: 6 }}
                >
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Icon name="note-text-outline" size={18} color={c.ink} />
                    <Marked text={n.title.trim() || t('Untitled note')} query={query} style={{ flex: 1, fontFamily: FONTS.bold, fontSize: fs(16), color: c.ink }} />
                    {n.locked ? <Icon name="lock" size={16} color={c.muted} /> : null}
                  </View>
                  {snip ? <Marked text={snip} query={n.locked ? '' : query} style={{ fontFamily: FONTS.medium, fontSize: fs(13), lineHeight: fs(19), color: c.muted }} /> : null}
                  {cat2 ? (
                    <T variant="label" muted fixed>
                      {cat2.name}
                    </T>
                  ) : null}
                </Brutal>
              );
            })}
            {taskHits.length > 0 ? <SectionLabel>{t('Tasks')}</SectionLabel> : null}
            {taskHits.map((x) => (
              <Brutal key={x.id} depth={3} radius={16} onPress={() => router.push(`/task/${x.id}`)} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
                <CheckBox checked={x.done} onPress={() => useData.getState().toggleTask(x.id)} />
                <Marked text={x.title} query={query} style={{ flex: 1, fontFamily: FONTS.bold, fontSize: fs(15), color: c.ink }} />
              </Brutal>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
