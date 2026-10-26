import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { useT } from '@/i18n';
import { haptic } from '@/services/haptics';
import { startOfDay } from '@/utils/date';
import { Button, Chip, ChipRow, Icon, Sheet, T } from '@/components/ui';

interface Props {
  visible: boolean;
  value: number | null;
  onClose: () => void;
  onConfirm: (ts: number) => void;
  onClear?: () => void;
  title?: string;
  /** When true only the date is picked (time defaults to 09:00). */
  dateOnly?: boolean;
  minToday?: boolean;
}

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function monthLabel(y: number, m: number): string {
  try {
    return new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  } catch {
    return `${m + 1}/${y}`;
  }
}

function Stepper({ label, value, onUp, onDown }: { label: string; value: string; onUp: () => void; onDown: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Pressable onPress={onUp} hitSlop={8} accessibilityLabel={`${label} +`} style={{ padding: 4 }}>
        <Icon name="chevron-up" size={26} color={c.ink} />
      </Pressable>
      <View style={{ minWidth: 64, paddingVertical: 8, borderWidth: 2.5, borderColor: c.line, borderRadius: 14, backgroundColor: c.surface2, alignItems: 'center' }}>
        <T variant="h1" fixed>
          {value}
        </T>
      </View>
      <Pressable onPress={onDown} hitSlop={8} accessibilityLabel={`${label} -`} style={{ padding: 4 }}>
        <Icon name="chevron-down" size={26} color={c.ink} />
      </Pressable>
    </View>
  );
}

export function DateTimeSheet({ visible, value, onClose, onConfirm, onClear, title, dateOnly, minToday }: Props) {
  const { c } = useTheme();
  const t = useT();
  const base = useMemo(() => {
    const d = new Date(value ?? Date.now() + 3600_000);
    if (value === null) d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    return d;
  }, [value, visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const [year, setYear] = useState(base.getFullYear());
  const [month, setMonth] = useState(base.getMonth());
  const [day, setDay] = useState(startOfDay(base.getTime()));
  const [hour24, setHour24] = useState(dateOnly ? 9 : base.getHours());
  const [minute, setMinute] = useState(dateOnly ? 0 : base.getMinutes());

  useEffect(() => {
    if (!visible) return;
    setYear(base.getFullYear());
    setMonth(base.getMonth());
    setDay(startOfDay(base.getTime()));
    setHour24(dateOnly ? 9 : base.getHours());
    setMinute(dateOnly ? 0 : base.getMinutes());
  }, [visible, base, dateOnly]);

  const first = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const todayStart = startOfDay(Date.now());

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const compose = () => {
    const d = new Date(day);
    d.setHours(hour24, minute, 0, 0);
    return d.getTime();
  };

  const setPreset = (ts: number) => {
    const d = new Date(ts);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setDay(startOfDay(ts));
    setHour24(d.getHours());
    setMinute(d.getMinutes());
    haptic('select');
  };

  const presets = () => {
    const now = new Date();
    const inHour = new Date(now.getTime() + 3600_000);
    inHour.setMinutes(Math.ceil(inHour.getMinutes() / 5) * 5, 0, 0);
    const tonight = new Date();
    tonight.setHours(20, 0, 0, 0);
    if (tonight.getTime() < now.getTime()) tonight.setDate(tonight.getDate() + 1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const monday = new Date();
    monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7));
    monday.setHours(9, 0, 0, 0);
    return [
      { label: t('In 1 hour'), ts: inHour.getTime() },
      { label: t('Tonight'), ts: tonight.getTime() },
      { label: t('Tomorrow'), ts: tomorrow.getTime() },
      { label: t('Next Monday'), ts: monday.getTime() },
    ];
  };

  const isPm = hour24 >= 12;
  const hour12 = hour24 % 12 || 12;
  const setHour12 = (h: number) => setHour24((isPm ? 12 : 0) + (h % 12));
  const final = compose();
  const inPast = minToday && final < Date.now() - 60_000;

  return (
    <Sheet visible={visible} onClose={onClose} title={title ?? t('Pick date & time')} maxHeightRatio={0.92}>
      {!dateOnly ? (
        <ChipRow>
          {presets().map((p) => (
            <Chip key={p.label} label={p.label} onPress={() => setPreset(p.ts)} />
          ))}
        </ChipRow>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 8 }}>
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} accessibilityLabel={t('Previous month')}>
          <Icon name="chevron-left" size={28} color={c.ink} />
        </Pressable>
        <T variant="h2">{monthLabel(year, month)}</T>
        <Pressable onPress={() => shiftMonth(1)} hitSlop={10} accessibilityLabel={t('Next month')}>
          <Icon name="chevron-right" size={28} color={c.ink} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEK.map((w, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
            <T variant="label" muted fixed>
              {w}
            </T>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          if (d === null) return <View key={i} style={{ width: `${100 / 7}%`, height: 46 }} />;
          const ts = startOfDay(new Date(year, month, d).getTime());
          const selected = ts === day;
          const isToday = ts === todayStart;
          const disabled = !!minToday && ts < todayStart;
          return (
            <Pressable
              key={i}
              disabled={disabled}
              onPress={() => {
                haptic('select');
                setDay(ts);
              }}
              accessibilityLabel={new Date(ts).toDateString()}
              accessibilityState={{ selected, disabled }}
              style={{ width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? c.primary : 'transparent',
                  borderWidth: selected || isToday ? 2.5 : 0,
                  borderColor: c.line,
                }}
              >
                <T variant="bodyBold" fixed color={selected ? '#111' : c.ink}>
                  {d}
                </T>
              </View>
            </Pressable>
          );
        })}
      </View>

      {!dateOnly ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 14 }}>
          <Stepper label={t('Hour')} value={String(hour12)} onUp={() => setHour12(hour12 + 1)} onDown={() => setHour12(hour12 - 1 <= 0 ? 12 : hour12 - 1)} />
          <T variant="h1" fixed>
            :
          </T>
          <Stepper
            label={t('Minute')}
            value={String(minute).padStart(2, '0')}
            onUp={() => setMinute((m) => (m + 5 >= 60 ? 0 : m + 5 - (m % 5)))}
            onDown={() => setMinute((m) => (m % 5 !== 0 ? m - (m % 5) : m - 5 < 0 ? 55 : m - 5))}
          />
          <View style={{ gap: 8 }}>
            {(['AM', 'PM'] as const).map((p) => {
              const on = (p === 'PM') === isPm;
              return (
                <Pressable
                  key={p}
                  onPress={() => {
                    haptic('select');
                    setHour24((h) => (p === 'PM' ? (h % 12) + 12 : h % 12));
                  }}
                  style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 2.5, borderColor: c.line, backgroundColor: on ? c.primary : c.surface }}
                >
                  <T variant="label" fixed color={on ? '#111' : c.ink}>
                    {p}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {inPast ? (
        <T variant="small" color={c.danger} center style={{ marginTop: 12 }}>
          {t('That time has already passed')}
        </T>
      ) : null}
      <View style={{ marginTop: 18, gap: 12 }}>
        <Button
          label={t('Set')}
          icon="check"
          disabled={inPast}
          onPress={() => {
            onConfirm(final);
            onClose();
          }}
        />
        {onClear ? (
          <Button
            label={t('Remove')}
            kind="light"
            onPress={() => {
              onClear();
              onClose();
            }}
          />
        ) : null}
      </View>
    </Sheet>
  );
}
