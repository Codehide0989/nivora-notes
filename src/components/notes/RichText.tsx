import React, { useMemo } from 'react';
import { Pressable, Text, TextStyle, View } from 'react-native';
import { FONTS, useTheme } from '@/theme';
import { parseBlocks, Inline, toggleCheckLine } from '@/utils/markdown';
import { Icon } from '@/components/ui';

function Spans({ inline, base }: { inline: Inline[]; base: TextStyle }) {
  const { c } = useTheme();
  return (
    <Text style={base}>
      {inline.map((i, k) => {
        const s: TextStyle = {};
        if (i.bold) s.fontFamily = FONTS.bold;
        if (i.italic) s.fontStyle = 'italic';
        const deco: string[] = [];
        if (i.underline) deco.push('underline');
        if (i.strike) deco.push('line-through');
        if (deco.length) s.textDecorationLine = deco.join(' ') as TextStyle['textDecorationLine'];
        if (i.hl) {
          s.backgroundColor = '#FFE45C';
          s.color = '#111';
        }
        if (i.code) {
          s.fontFamily = FONTS.mono;
          s.backgroundColor = c.surface2;
          s.fontSize = (base.fontSize ?? 16) - 1;
        }
        return (
          <Text key={k} style={s}>
            {i.text}
          </Text>
        );
      })}
    </Text>
  );
}

interface Props {
  body: string;
  onChangeBody?: (next: string) => void;
}

export function RichText({ body, onChangeBody }: Props) {
  const { c, fs } = useTheme();
  const blocks = useMemo(() => parseBlocks(body), [body]);
  const text: TextStyle = { fontFamily: FONTS.medium, fontSize: fs(16), lineHeight: fs(25), color: c.ink };
  return (
    <View>
      {blocks.map((b, idx) => {
        switch (b.type) {
          case 'blank':
            return <View key={idx} style={{ height: 8 }} />;
          case 'hr':
            return <View key={idx} style={{ height: 3, backgroundColor: c.line, marginVertical: 12, borderRadius: 2 }} />;
          case 'h': {
            const size = b.level === 1 ? 26 : b.level === 2 ? 21 : 18;
            return (
              <View key={idx} style={{ marginTop: 10, marginBottom: 4 }}>
                <Spans
                  inline={b.inline}
                  base={{ fontFamily: FONTS.display, fontSize: fs(size), lineHeight: fs(size + 6), color: c.ink, textTransform: b.level === 3 ? 'none' : 'uppercase' }}
                />
              </View>
            );
          }
          case 'p':
            return (
              <View key={idx} style={{ marginVertical: 2 }}>
                <Spans inline={b.inline} base={text} />
              </View>
            );
          case 'bullet':
            return (
              <View key={idx} style={{ flexDirection: 'row', gap: 10, marginVertical: 2, paddingLeft: b.indent * 18 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: c.ink, marginTop: fs(9) }} />
                <View style={{ flex: 1 }}>
                  <Spans inline={b.inline} base={text} />
                </View>
              </View>
            );
          case 'num':
            return (
              <View key={idx} style={{ flexDirection: 'row', gap: 8, marginVertical: 2, paddingLeft: b.indent * 18 }}>
                <Text style={[text, { fontFamily: FONTS.bold, minWidth: 22 }]}>{b.n}.</Text>
                <View style={{ flex: 1 }}>
                  <Spans inline={b.inline} base={text} />
                </View>
              </View>
            );
          case 'check':
            return (
              <Pressable
                key={idx}
                disabled={!onChangeBody}
                onPress={() => onChangeBody?.(toggleCheckLine(body, b.line))}
                style={{ flexDirection: 'row', gap: 10, marginVertical: 3, paddingLeft: b.indent * 18, alignItems: 'flex-start' }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: b.checked }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 7,
                    borderWidth: 2.5,
                    borderColor: c.line,
                    backgroundColor: b.checked ? c.primary : c.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: fs(1),
                  }}
                >
                  {b.checked ? <Icon name="check" size={16} color="#111" /> : null}
                </View>
                <View style={{ flex: 1, opacity: b.checked ? 0.55 : 1 }}>
                  <Spans
                    inline={b.inline}
                    base={{ ...text, textDecorationLine: b.checked ? 'line-through' : 'none' }}
                  />
                </View>
              </Pressable>
            );
          case 'quote':
            return (
              <View key={idx} style={{ borderLeftWidth: 5, borderLeftColor: c.primary, backgroundColor: c.surface2, paddingVertical: 8, paddingHorizontal: 12, marginVertical: 6, borderRadius: 6 }}>
                <Spans inline={b.inline} base={{ ...text, fontStyle: 'italic' }} />
              </View>
            );
          case 'code':
            return (
              <View key={idx} style={{ backgroundColor: c.surface2, borderWidth: 2, borderColor: c.line, borderRadius: 10, padding: 12, marginVertical: 6 }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: fs(13), color: c.ink }}>{b.text}</Text>
              </View>
            );
        }
      })}
    </View>
  );
}
