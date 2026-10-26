import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTheme } from '@/theme';
import { haptic } from '@/services/haptics';
import { Icon } from '@/components/ui';

export type FormatAction =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'highlight'
  | 'code'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'num'
  | 'check'
  | 'quote'
  | 'hr'
  | 'indent'
  | 'outdent'
  | 'undo'
  | 'redo';

const ITEMS: { a: FormatAction; icon: string; label: string; gap?: boolean }[] = [
  { a: 'undo', icon: 'undo-variant', label: 'Undo' },
  { a: 'redo', icon: 'redo-variant', label: 'Redo', gap: true },
  { a: 'bold', icon: 'format-bold', label: 'Bold' },
  { a: 'italic', icon: 'format-italic', label: 'Italic' },
  { a: 'underline', icon: 'format-underline', label: 'Underline' },
  { a: 'strike', icon: 'format-strikethrough-variant', label: 'Strikethrough' },
  { a: 'highlight', icon: 'marker', label: 'Highlight', gap: true },
  { a: 'h1', icon: 'format-header-1', label: 'Heading 1' },
  { a: 'h2', icon: 'format-header-2', label: 'Heading 2' },
  { a: 'h3', icon: 'format-header-3', label: 'Heading 3', gap: true },
  { a: 'bullet', icon: 'format-list-bulleted', label: 'Bullet list' },
  { a: 'num', icon: 'format-list-numbered', label: 'Numbered list' },
  { a: 'check', icon: 'checkbox-marked-outline', label: 'Checklist', gap: true },
  { a: 'quote', icon: 'format-quote-close', label: 'Quote' },
  { a: 'code', icon: 'code-tags', label: 'Code' },
  { a: 'hr', icon: 'minus', label: 'Divider', gap: true },
  { a: 'outdent', icon: 'format-indent-decrease', label: 'Outdent' },
  { a: 'indent', icon: 'format-indent-increase', label: 'Indent' },
];

export function FormatToolbar({ onAction, canUndo, canRedo }: { onAction: (a: FormatAction) => void; canUndo: boolean; canRedo: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c.surface, borderTopWidth: 2.5, borderColor: c.line }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' }}>
        {ITEMS.map((it) => {
          const disabled = (it.a === 'undo' && !canUndo) || (it.a === 'redo' && !canRedo);
          return (
            <Pressable
              key={it.a}
              accessibilityLabel={it.label}
              disabled={disabled}
              onPress={() => {
                haptic('select');
                onAction(it.a);
              }}
              style={({ pressed }) => ({
                width: 42,
                height: 42,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: it.gap ? 14 : 4,
                backgroundColor: pressed ? c.primary : 'transparent',
                opacity: disabled ? 0.3 : 1,
              })}
            >
              <Icon name={it.icon} size={23} color={c.ink} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
