import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTS, useTheme } from '@/theme';
import { useData } from '@/store/data';
import { useSession } from '@/store/session';
import { toast } from '@/store/ui';
import { tNow, useT } from '@/i18n';
import { haptic } from '@/services/haptics';
import { isNoteUnlocked, markNoteUnlocked, requestUnlock } from '@/services/gate';
import { pickImages, takePhoto } from '@/services/media';
import { continueList, FormatResult, indentLines, insertSnippet, Sel, toggleLineKind, wrapSelection } from '@/utils/format';
import { wordCount } from '@/utils/markdown';
import { formatDateTime } from '@/utils/date';
import { Chip, ChipRow, goBack, Icon, IconButton, Sheet, T } from '@/components/ui';
import { FormatAction, FormatToolbar } from '@/components/notes/FormatToolbar';
import { RichText } from '@/components/notes/RichText';
import { AudioClip } from '@/components/app/Audio';
import { ActionRow, CategorySheet, ColorDots } from '@/components/app/Pickers';
import { dueLabel } from '@/components/app/Rows';
import type { Attachment, Note } from '@/types';

export default function NoteRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const note = useData((s) => s.notes.find((n) => n.id === id));
  const { c } = useTheme();
  const [allowed, setAllowed] = useState(() => !note?.locked || isNoteUnlocked(id));

  useEffect(() => {
    if (!note) {
      goBack();
      return;
    }
    if (allowed || !note.locked) return;
    let alive = true;
    void requestUnlock(tNow('Unlock this note')).then((ok) => {
      if (!alive) return;
      if (ok) {
        markNoteUnlocked(id);
        setAllowed(true);
      } else goBack();
    });
    return () => {
      alive = false;
    };
  }, [note?.locked]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!note || (note.locked && !allowed)) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  return <Editor id={id} initial={note} />;
}

function isEmpty(n: Note): boolean {
  return !n.title.trim() && !n.body.trim() && n.attachments.length === 0 && !n.locked;
}

function Editor({ id, initial }: { id: string; initial: Note }) {
  const t = useT();
  const { c, isDark, noteBg, fs } = useTheme();
  const insets = useSafeAreaInsets();
  const { new: isNewParam } = useLocalSearchParams<{ new?: string }>();
  const note = useData((s) => s.notes.find((n) => n.id === id)) ?? initial;
  const categories = useData((s) => s.categories);
  const reminder = useData((s) => s.reminders.find((r) => r.noteId === id && !r.done));
  const pinSet = useSession((s) => s.pinSet);
  const update = useData((s) => s.updateNote);

  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [mode, setMode] = useState<'edit' | 'preview'>(initial.body.trim() || initial.title.trim() ? (isNewParam ? 'edit' : 'preview') : 'edit');
  const [focused, setFocused] = useState(false);
  const [menu, setMenu] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [viewer, setViewer] = useState<Attachment | null>(null);
  const [forcedSel, setForcedSel] = useState<Sel | null>(null);
  const [, bump] = useState(0);

  const titleRef = useRef(title);
  const bodyRef = useRef(body);
  titleRef.current = title;
  bodyRef.current = body;
  const selRef = useRef<Sel>({ start: initial.body.length, end: initial.body.length });
  const bodyInput = useRef<TextInput>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hist = useRef({ stack: [{ text: initial.body, sel: { start: 0, end: 0 } as Sel }], i: 0 });

  const bg = noteBg(note.color);
  const cat = categories.find((x) => x.id === note.categoryId);

  /* ---------- persistence ---------- */
  const flush = useCallback(() => {
    const cur = useData.getState().notes.find((n) => n.id === id);
    if (!cur) return;
    if (cur.title !== titleRef.current || cur.body !== bodyRef.current) {
      useData.getState().updateNote(id, { title: titleRef.current, body: bodyRef.current });
    }
  }, [id]);

  useEffect(() => {
    if (title === note.title && body === note.body) return;
    const h = setTimeout(flush, 450);
    return () => clearTimeout(h);
  }, [title, body]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      flush();
      const cur = useData.getState().notes.find((n) => n.id === id);
      if (cur && isEmpty(cur)) useData.getState().deleteNoteForever(id);
    },
    [flush, id],
  );

  /* ---------- history ---------- */
  const commit = (text: string, sel: Sel) => {
    const h = hist.current;
    if (h.stack[h.i].text === text) return;
    h.stack = h.stack.slice(0, h.i + 1);
    h.stack.push({ text, sel });
    if (h.stack.length > 120) h.stack.shift();
    h.i = h.stack.length - 1;
    bump((n) => n + 1);
  };
  const applySel = (sel: Sel) => {
    selRef.current = sel;
    setForcedSel(sel);
    setTimeout(() => setForcedSel(null), 80);
  };
  const jump = (dir: -1 | 1) => {
    const h = hist.current;
    const next = h.i + dir;
    if (next < 0 || next >= h.stack.length) return;
    h.i = next;
    const s = h.stack[next];
    setBody(s.text);
    applySel(s.sel);
    bump((n) => n + 1);
  };

  const onChangeBody = (text: string) => {
    const prev = bodyRef.current;
    let i = 0;
    while (i < prev.length && i < text.length && prev[i] === text[i]) i += 1;
    const cont = continueList(prev, text, i + 1);
    if (cont) {
      setBody(cont.text);
      applySel(cont.sel);
      commit(cont.text, cont.sel);
      return;
    }
    setBody(text);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => commit(text, selRef.current), 700);
  };

  const format = (a: FormatAction) => {
    if (a === 'undo') return jump(-1);
    if (a === 'redo') return jump(1);
    const text = bodyRef.current;
    const sel = selRef.current;
    let r: FormatResult;
    switch (a) {
      case 'bold': r = wrapSelection(text, sel, '**'); break;
      case 'italic': r = wrapSelection(text, sel, '*'); break;
      case 'underline': r = wrapSelection(text, sel, '++'); break;
      case 'strike': r = wrapSelection(text, sel, '~~'); break;
      case 'highlight': r = wrapSelection(text, sel, '=='); break;
      case 'code': r = wrapSelection(text, sel, '`'); break;
      case 'h1': r = toggleLineKind(text, sel, 'h1'); break;
      case 'h2': r = toggleLineKind(text, sel, 'h2'); break;
      case 'h3': r = toggleLineKind(text, sel, 'h3'); break;
      case 'bullet': r = toggleLineKind(text, sel, 'bullet'); break;
      case 'num': r = toggleLineKind(text, sel, 'num'); break;
      case 'check': r = toggleLineKind(text, sel, 'check'); break;
      case 'quote': r = toggleLineKind(text, sel, 'quote'); break;
      case 'hr': r = insertSnippet(text, sel, `${text.length && !text.slice(0, sel.start).endsWith('\n') ? '\n' : ''}---\n`); break;
      case 'indent': r = indentLines(text, sel, false); break;
      case 'outdent': r = indentLines(text, sel, true); break;
      default: return;
    }
    setBody(r.text);
    applySel(r.sel);
    commit(r.text, r.sel);
  };

  /* ---------- attachments ---------- */
  const addAttachments = (items: Attachment[]) => {
    const cur = useData.getState().notes.find((n) => n.id === id);
    if (cur) update(id, { attachments: [...cur.attachments, ...items] });
  };
  const addImages = async (camera: boolean) => {
    setMenu(false);
    const res = camera ? await takePhoto() : await pickImages();
    if (res.ok) {
      addAttachments(res.items);
      haptic('success');
    } else if (res.reason === 'denied') toast.error(t('Permission denied. Enable it in your device settings.'));
    else if (res.reason === 'error') toast.error(t('Could not open the picker'));
  };
  const removeAttachment = (a: Attachment) => {
    update(id, { attachments: note.attachments.filter((x) => x.id !== a.id) });
    setViewer(null);
    toast.show(a.type === 'image' ? t('Image removed') : t('Recording removed'), {
      actionLabel: t('Undo'),
      onAction: () => {
        const cur = useData.getState().notes.find((n) => n.id === id);
        if (cur) update(id, { attachments: [...cur.attachments, a] });
      },
    });
  };

  /* ---------- actions ---------- */
  const done = () => {
    flush();
    const cur = useData.getState().notes.find((n) => n.id === id);
    if (!cur || isEmpty(cur)) return goBack();
    haptic('success');
    if (isNewParam) router.replace(`/status/note-saved?noteId=${id}`);
    else {
      toast.success(t('Note saved'));
      goBack();
    }
  };

  const toggleLock = async () => {
    setMenu(false);
    if (note.locked) {
      if (await requestUnlock(t('Unlock to remove the lock'))) {
        update(id, { locked: false });
        toast.success(t('Note unlocked'));
      }
      return;
    }
    if (!pinSet) {
      toast.show(t('Create a PIN first to lock notes'), { actionLabel: t('Set PIN'), onAction: () => router.push('/prefs/pin?mode=create') });
      return;
    }
    update(id, { locked: true });
    markNoteUnlocked(id);
    toast.success(t('Note locked'));
  };

  const trash = () => {
    setMenu(false);
    flush();
    useData.getState().trashNote(id);
    router.replace(`/status/note-deleted?id=${id}`);
  };

  const images = note.attachments.filter((a) => a.type === 'image');
  const audio = note.attachments.filter((a) => a.type === 'audio');
  const words = wordCount(body);
  const h = hist.current;

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
        <IconButton icon="arrow-left" label={t('Back')} onPress={() => { flush(); goBack(); }} />
        <View style={{ flex: 1 }} />
        <IconButton icon={mode === 'edit' ? 'eye-outline' : 'pencil-outline'} label={mode === 'edit' ? t('Preview') : t('Edit')} onPress={() => { flush(); setMode(mode === 'edit' ? 'preview' : 'edit'); }} />
        <IconButton icon="dots-vertical" label={t('More')} onPress={() => setMenu(true)} />
        <IconButton icon="check-bold" label={t('Done')} bg={c.primary} color="#111" onPress={done} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('Title')}
            placeholderTextColor={c.muted}
            multiline
            blurOnSubmit
            returnKeyType="next"
            onSubmitEditing={() => bodyInput.current?.focus()}
            editable={mode === 'edit'}
            selectionColor={c.primary}
            style={{ fontFamily: FONTS.display, fontSize: fs(28), lineHeight: fs(34), color: c.ink, textTransform: 'uppercase', paddingVertical: 6 }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2, marginBottom: 10 }}>
            <T variant="label" muted fixed>
              {formatDateTime(note.updatedAt)}
            </T>
            <T variant="label" muted fixed>
              · {t(words === 1 ? '{n} word' : '{n} words', { n: words })}
            </T>
            {note.locked ? <Icon name="lock" size={14} color={c.muted} /> : null}
            {note.pinned ? <Icon name="pin" size={14} color={c.muted} /> : null}
          </View>

          <ChipRow style={{ paddingLeft: 0 }}>
            <Chip label={cat ? cat.name : t('Category')} icon={cat ? cat.icon : 'folder-outline'} onPress={() => setCatOpen(true)} />
            <Chip label={reminder ? dueLabel(reminder.at, t) : t('Reminder')} icon={reminder ? 'bell-ring' : 'bell-plus-outline'} selected={!!reminder} onPress={() => router.push(reminder ? `/reminder/${reminder.id}` : `/reminder/new?noteId=${id}`)} />
            <Chip label={t('Image')} icon="image-plus" onPress={() => void addImages(false)} />
            <Chip label={t('Voice')} icon="microphone" onPress={() => router.push(`/voice?noteId=${id}`)} />
            <Chip label={t('Colour')} icon="palette-outline" onPress={() => setColorOpen(true)} />
          </ChipRow>

          <View style={{ marginTop: 12, minHeight: 200 }}>
            {mode === 'edit' ? (
              <TextInput
                ref={bodyInput}
                value={body}
                onChangeText={onChangeBody}
                onSelectionChange={(e) => {
                  selRef.current = e.nativeEvent.selection;
                }}
                selection={forcedSel ?? undefined}
                onFocus={() => setFocused(true)}
                onBlur={() => {
                  setFocused(false);
                  commit(bodyRef.current, selRef.current);
                }}
                placeholder={t('Start writing… use the toolbar for headings, lists and checklists.')}
                placeholderTextColor={c.muted}
                multiline
                scrollEnabled={false}
                textAlignVertical="top"
                selectionColor={c.primary}
                style={{ fontFamily: FONTS.medium, fontSize: fs(16), lineHeight: fs(25), color: c.ink, minHeight: 220, padding: 0 }}
              />
            ) : body.trim() ? (
              <RichText
                body={body}
                onChangeBody={(next) => {
                  setBody(next);
                  commit(next, selRef.current);
                  haptic('light');
                }}
              />
            ) : (
              <Pressable onPress={() => setMode('edit')}>
                <T variant="body" muted>
                  {t('Empty note. Tap to start writing.')}
                </T>
              </Pressable>
            )}
          </View>

          {images.length > 0 ? (
            <View style={{ marginTop: 18 }}>
              <T variant="caps" muted style={{ marginBottom: 8 }}>
                {t('Images')}
              </T>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }}>
                {images.map((a) => (
                  <Pressable key={a.id} onPress={() => setViewer(a)} onLongPress={() => removeAttachment(a)} accessibilityLabel={t('Open image')}>
                    <Image source={{ uri: a.uri }} style={{ width: 132, height: 132, borderRadius: 16, borderWidth: 2.5, borderColor: c.line, backgroundColor: c.surface2 }} contentFit="cover" transition={150} />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {audio.length > 0 ? (
            <View style={{ marginTop: 18, gap: 12 }}>
              <T variant="caps" muted>
                {t('Voice notes')}
              </T>
              {audio.map((a) => (
                <AudioClip key={a.id} uri={a.uri} duration={a.duration} onRemove={() => removeAttachment(a)} />
              ))}
            </View>
          ) : null}
        </ScrollView>
        {mode === 'edit' && focused ? <FormatToolbar onAction={format} canUndo={h.i > 0} canRedo={h.i < h.stack.length - 1} /> : null}
      </KeyboardAvoidingView>

      {/* ---------- more menu ---------- */}
      <Sheet visible={menu} onClose={() => setMenu(false)} title={t('Note options')}>
        <ActionRow icon={note.pinned ? 'pin-off-outline' : 'pin-outline'} label={note.pinned ? t('Unpin') : t('Pin to top')} onPress={() => { useData.getState().togglePin(id); setMenu(false); }} />
        <ActionRow icon={note.locked ? 'lock-open-variant-outline' : 'lock-outline'} label={note.locked ? t('Remove lock') : t('Lock note')} hint={t('Needs your PIN or fingerprint to open')} onPress={() => void toggleLock()} />
        <ActionRow icon="image-plus" label={t('Add image from gallery')} onPress={() => void addImages(false)} />
        <ActionRow icon="camera-outline" label={t('Take a photo')} onPress={() => void addImages(true)} />
        <ActionRow icon="microphone-outline" label={t('Record voice note')} onPress={() => { setMenu(false); router.push(`/voice?noteId=${id}`); }} />
        <ActionRow icon="share-variant-outline" label={t('Share')} onPress={() => { setMenu(false); flush(); router.push(`/share/${id}`); }} />
        <ActionRow icon="export-variant" label={t('Export')} onPress={() => { setMenu(false); flush(); router.push(`/export/${id}`); }} />
        <ActionRow
          icon="content-copy"
          label={t('Duplicate')}
          onPress={() => {
            setMenu(false);
            flush();
            const copy = useData.getState().duplicateNote(id);
            if (copy) {
              toast.success(t('Duplicated'));
              router.replace(`/note/${copy.id}`);
            }
          }}
        />
        <ActionRow icon="delete-outline" danger label={t('Move to Trash')} last onPress={trash} />
      </Sheet>

      <Sheet visible={colorOpen} onClose={() => setColorOpen(false)} title={t('Note colour')}>
        <ColorDots value={note.color} onChange={(k) => { update(id, { color: k }); setColorOpen(false); }} />
      </Sheet>

      <CategorySheet visible={catOpen} onClose={() => setCatOpen(false)} value={note.categoryId} onSelect={(cid) => update(id, { categoryId: cid })} />

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' }}>
          {viewer ? <Image source={{ uri: viewer.uri }} style={{ width: '100%', height: '78%' }} contentFit="contain" /> : null}
          <View style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
            <IconButton icon="close" label={t('Close')} onPress={() => setViewer(null)} />
            {viewer ? <IconButton icon="delete-outline" label={t('Remove')} bg={c.danger} color="#fff" onPress={() => removeAttachment(viewer)} /> : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}
