import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useTheme } from '@/theme';
import { useT } from '@/i18n';
import { haptic } from '@/services/haptics';
import { importFile } from '@/services/media';
import { external } from '@/store/session';
import { toast } from '@/store/ui';
import { formatDuration } from '@/utils/date';
import { Brutal, Button, Icon, T } from '@/components/ui';

export interface RecordedClip {
  id: string;
  uri: string;
  duration: number;
}

/** Playback row for a recorded clip. */
export function AudioClip({ uri, duration, onRemove, bg }: { uri: string; duration?: number; onRemove?: () => void; bg?: string }) {
  const { c } = useTheme();
  const t = useT();
  const source = useMemo(() => ({ uri }), [uri]);
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  const total = status.duration > 0 ? status.duration : duration ?? 0;
  const pos = status.currentTime ?? 0;
  const ratio = total > 0 ? Math.min(1, pos / total) : 0;

  const toggle = async () => {
    try {
      if (status.playing) {
        player.pause();
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      if (total > 0 && pos >= total - 0.15) await player.seekTo(0);
      player.play();
    } catch {
      toast.error(t('Could not play this recording'));
    }
  };

  return (
    <Brutal bg={bg ?? c.surface} depth={3} radius={16} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}>
      <Pressable
        onPress={() => {
          haptic('light');
          void toggle();
        }}
        accessibilityLabel={status.playing ? t('Pause') : t('Play')}
        style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: c.primary, borderWidth: 2.5, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name={status.playing ? 'pause' : 'play'} size={26} color="#111" />
      </Pressable>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ height: 10, borderRadius: 5, borderWidth: 2, borderColor: c.line, overflow: 'hidden', backgroundColor: c.surface2 }}>
          <View style={{ width: `${ratio * 100}%`, height: '100%', backgroundColor: c.orange }} />
        </View>
        <T variant="label" muted fixed>
          {formatDuration(pos)} / {formatDuration(total)}
        </T>
      </View>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel={t('Remove')}>
          <Icon name="close-circle-outline" size={24} color={c.muted} />
        </Pressable>
      ) : null}
    </Brutal>
  );
}

const BARS = 36;

export function Waveform({ levels, active }: { levels: number[]; active: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ height: 96, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
      {levels.map((v, i) => (
        <View
          key={i}
          style={{
            width: 5,
            height: 6 + v * 84,
            borderRadius: 3,
            backgroundColor: active && i > levels.length - 8 ? c.orange : c.ink,
            opacity: 0.25 + (i / levels.length) * 0.75,
          }}
        />
      ))}
    </View>
  );
}

type Phase = 'idle' | 'recording' | 'paused' | 'done';

/** Voice recorder with live waveform, pause/resume and a preview step before saving. */
export function Recorder({ onSave, onCancel, saveLabel }: { onSave: (clip: RecordedClip) => void; onCancel?: () => void; saveLabel?: string }) {
  const { c } = useTheme();
  const t = useT();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 90);
  const [phase, setPhase] = useState<Phase>('idle');
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.04));
  const [clip, setClip] = useState<{ uri: string; duration: number } | null>(null);
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;

  useEffect(() => {
    if (phase !== 'recording') return;
    const db = typeof state.metering === 'number' ? state.metering : -45 + Math.random() * 25;
    const v = Math.max(0.04, Math.min(1, (db + 55) / 55));
    setLevels((l) => [...l.slice(1), v]);
  }, [state.durationMillis, state.metering, phase]);

  useEffect(
    () => () => {
      if (phaseRef.current === 'recording' || phaseRef.current === 'paused') {
        recorder.stop().catch(() => undefined);
      }
    },
    [recorder],
  );

  const start = async () => {
    try {
      const perm = await external(() => AudioModule.requestRecordingPermissionsAsync());
      if (!perm.granted) {
        toast.error(t('Microphone permission is needed to record'));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      haptic('medium');
      setLevels(Array(BARS).fill(0.04));
      setPhase('recording');
    } catch {
      toast.error(t('Could not start recording'));
    }
  };

  const pauseResume = () => {
    haptic('light');
    if (phase === 'recording') {
      recorder.pause();
      setPhase('paused');
    } else if (phase === 'paused') {
      recorder.record();
      setPhase('recording');
    }
  };

  const stop = async () => {
    try {
      const seconds = state.durationMillis / 1000;
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (!uri) throw new Error('no uri');
      haptic('success');
      setClip({ uri, duration: seconds });
      setPhase('done');
    } catch {
      toast.error(t('Recording failed'));
      setPhase('idle');
    }
  };

  const save = () => {
    if (!clip) return;
    try {
      const saved = importFile(clip.uri, 'm4a');
      onSave({ id: saved.id, uri: saved.uri, duration: clip.duration });
    } catch {
      toast.error(t('Could not save the recording'));
    }
  };

  const discard = () => {
    setClip(null);
    setPhase('idle');
    setLevels(Array(BARS).fill(0.04));
  };

  const seconds = phase === 'done' && clip ? clip.duration : state.durationMillis / 1000;
  const recording = phase === 'recording';

  return (
    <View style={{ alignItems: 'center', gap: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: recording ? c.danger : c.muted, opacity: recording ? 1 : 0.5 }} />
        <T variant="display" fixed style={{ fontSize: 52, lineHeight: 58 }}>
          {formatDuration(seconds)}
        </T>
      </View>
      <T variant="label" muted>
        {phase === 'idle' ? t('Tap the mic to start') : phase === 'recording' ? t('Recording…') : phase === 'paused' ? t('Paused') : t('Recording ready')}
      </T>

      {phase === 'done' && clip ? (
        <View style={{ alignSelf: 'stretch', gap: 14 }}>
          <AudioClip uri={clip.uri} duration={clip.duration} />
          <Button label={saveLabel ?? t('Save recording')} icon="check" onPress={save} />
          <Button label={t('Record again')} kind="light" icon="restart" onPress={discard} />
        </View>
      ) : (
        <>
          <Waveform levels={levels} active={recording} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22 }}>
            {phase !== 'idle' ? (
              <Brutal bg={c.surface} depth={3} radius={20} onPress={pauseResume} accessibilityLabel={phase === 'paused' ? t('Resume') : t('Pause')} contentStyle={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center', flexGrow: 0 }}>
                <Icon name={phase === 'paused' ? 'play' : 'pause'} size={30} color={c.ink} />
              </Brutal>
            ) : (
              <View style={{ width: 67 }} />
            )}
            <Brutal
              bg={recording || phase === 'paused' ? c.danger : c.primary}
              depth={5}
              radius={36}
              onPress={() => (phase === 'idle' ? void start() : void stop())}
              accessibilityLabel={phase === 'idle' ? t('Start recording') : t('Stop recording')}
              contentStyle={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center', flexGrow: 0 }}
            >
              <Icon name={phase === 'idle' ? 'microphone' : 'stop'} size={46} color={phase === 'idle' ? '#111' : '#fff'} />
            </Brutal>
            <View style={{ width: 67 }} />
          </View>
        </>
      )}
      {onCancel && phase !== 'done' ? (
        <Button label={t('Cancel')} kind="light" small onPress={onCancel} />
      ) : null}
    </View>
  );
}
