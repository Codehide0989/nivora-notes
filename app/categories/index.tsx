import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { NOTE_COLORS, useTheme } from '@/theme';
import { useData } from '@/store/data';
import { toast } from '@/store/ui';
import { useT } from '@/i18n';
import { Brutal, Button, Dialog, EmptyState, Field, Icon, IconButton, Screen, Sheet, T } from '@/components/ui';
import { ColorDots } from '@/components/app/Pickers';
import type { Category, NoteColor } from '@/types';

export const CATEGORY_ICONS = [
  'account-heart', 'briefcase', 'airplane', 'lightbulb-on', 'cart', 'book-open-variant', 'home', 'heart', 'dumbbell', 'silverware-fork-knife',
  'music', 'gamepad-variant', 'leaf', 'rocket-launch', 'school', 'cash', 'camera', 'palette', 'code-tags', 'star', 'flag', 'folder', 'paw', 'car',
];

export default function Categories() {
  const t = useT();
  const { c, isDark } = useTheme();
  const categories = useData((s) => s.categories);
  const notes = useData((s) => s.notes);
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('folder');
  const [color, setColor] = useState<NoteColor>('yellow');
  const [removing, setRemoving] = useState<Category | null>(null);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    notes.forEach((n) => {
      if (n.deletedAt === null && n.categoryId) m[n.categoryId] = (m[n.categoryId] ?? 0) + 1;
    });
    return m;
  }, [notes]);

  const openEditor = (cat: Category | 'new') => {
    setEditing(cat);
    if (cat === 'new') {
      setName('');
      setIcon('folder');
      setColor('yellow');
    } else {
      setName(cat.name);
      setIcon(cat.icon);
      setColor(cat.color);
    }
  };

  const save = () => {
    const n = name.trim();
    if (!n) return toast.error(t('Give the category a name'));
    if (categories.some((x) => x.name.toLowerCase() === n.toLowerCase() && (editing === 'new' || (editing && x.id !== editing.id))))
      return toast.error(t('A category with that name already exists'));
    const store = useData.getState();
    if (editing === 'new') store.addCategory({ name: n, icon, color });
    else if (editing) store.updateCategory(editing.id, { name: n, icon, color });
    toast.success(t('Category saved'));
    setEditing(null);
  };

  return (
    <Screen header={{ title: t('Categories'), subtitle: t('{n} categories', { n: categories.length }), right: <IconButton icon="plus" label={t('New category')} bg={c.primary} color="#111" onPress={() => openEditor('new')} /> }}>
      {categories.length === 0 ? (
        <EmptyState icon="folder-plus-outline" title={t('No categories')} message={t('Create categories to keep notes organised.')} actionLabel={t('New category')} onAction={() => openEditor('new')} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {categories.map((cat) => {
            const bg = isDark ? NOTE_COLORS[cat.color].dark : NOTE_COLORS[cat.color].light;
            return (
              <Brutal key={cat.id} bg={bg} depth={4} radius={20} style={{ width: '47.5%' }} onPress={() => router.push(`/category/${cat.id}`)} onLongPress={() => openEditor(cat)} contentStyle={{ padding: 14, minHeight: 130, justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Icon name={cat.icon} size={34} color={isDark ? c.ink : '#111'} />
                  <Pressable onPress={() => openEditor(cat)} hitSlop={10} accessibilityLabel={t('Edit category')}>
                    <Icon name="pencil-outline" size={20} color={isDark ? c.ink : '#111'} />
                  </Pressable>
                </View>
                <View>
                  <T variant="h3" color={isDark ? c.ink : '#111'} numberOfLines={1}>
                    {cat.name}
                  </T>
                  <T variant="label" color={isDark ? c.muted : '#333'} fixed>
                    {t(counts[cat.id] === 1 ? '{n} note' : '{n} notes', { n: counts[cat.id] ?? 0 })}
                  </T>
                </View>
              </Brutal>
            );
          })}
        </View>
      )}

      <Sheet visible={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? t('New category') : t('Edit category')}>
        <Field label={t('Name')} value={name} onChangeText={setName} placeholder={t('e.g. Recipes')} maxLength={24} autoFocus />
        <T variant="label" muted style={{ marginTop: 16, marginBottom: 8 }}>
          {t('Colour')}
        </T>
        <ColorDots value={color} onChange={setColor} />
        <T variant="label" muted style={{ marginTop: 16, marginBottom: 8 }}>
          {t('Icon')}
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {CATEGORY_ICONS.map((i) => (
            <Pressable key={i} onPress={() => setIcon(i)} accessibilityLabel={i} style={{ width: 46, height: 46, borderRadius: 14, borderWidth: icon === i ? 4 : 2.5, borderColor: c.line, backgroundColor: icon === i ? c.primary : c.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={i} size={24} color={icon === i ? '#111' : c.ink} />
            </Pressable>
          ))}
        </View>
        <View style={{ marginTop: 20, gap: 12 }}>
          <Button label={t('Save')} icon="check" onPress={save} />
          {editing && editing !== 'new' ? (
            <Button
              label={t('Delete category')}
              kind="danger"
              icon="delete-outline"
              onPress={() => {
                setRemoving(editing);
                setEditing(null);
              }}
            />
          ) : null}
        </View>
      </Sheet>

      <Dialog
        visible={!!removing}
        icon="folder-remove-outline"
        danger
        title={t('Delete category?')}
        message={t('Notes in “{name}” are kept and become uncategorised.', { name: removing?.name ?? '' })}
        confirmLabel={t('Delete')}
        onConfirm={() => {
          if (removing) useData.getState().deleteCategory(removing.id);
          setRemoving(null);
          toast.success(t('Category deleted'));
        }}
        onCancel={() => setRemoving(null)}
      />
    </Screen>
  );
}
