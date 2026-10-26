import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useTheme } from '@/theme';
import { addVaultItem, ensureVaultLoaded, removeVaultItem, updateVaultItem, useVault } from '@/store/vault';
import { toast } from '@/store/ui';
import { useT } from '@/i18n';
import { copyPlain, copySecret } from '@/services/clipboard';
import { GenOptions, generatePassword, passwordScore } from '@/services/crypto';
import { touchVault, useVaultAccess } from '@/services/vaultAccess';
import { haptic } from '@/services/haptics';
import { relativeTime } from '@/utils/date';
import { Brutal, Button, Chip, ChipRow, Dialog, EmptyState, Field, Icon, IconButton, ProgressBar, Screen, SectionLabel, SettingGroup, SettingRow, Sheet, Switch, T, goBack } from '@/components/ui';
import { VaultLock } from '@/components/app/VaultLock';
import { VAULT_CATEGORIES, normaliseUrl } from '@/components/app/VaultBits';
import type { VaultCategory } from '@/types';

export default function VaultEntry() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const t = useT();
  const { c } = useTheme();
  const { unlocked, pinSet } = useVaultAccess();
  const loaded = useVault((s) => s.loaded);
  const item = useVault((s) => s.items.find((i) => i.id === id));
  usePreventScreenCapture('vault-entry');

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<VaultCategory>('other');
  const [favourite, setFavourite] = useState(false);
  const [show, setShow] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [gen, setGen] = useState<GenOptions>({ length: 18, lower: true, upper: true, digits: true, symbols: true });
  const [preview, setPreview] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const filled = useRef(false);

  useEffect(() => {
    if (unlocked) void ensureVaultLoaded();
  }, [unlocked]);

  useEffect(() => {
    if (filled.current || !loaded) return;
    if (item) {
      filled.current = true;
      setTitle(item.title);
      setUrl(item.url);
      setUsername(item.username);
      setPassword(item.password);
      setNotes(item.notes);
      setCategory(item.category);
      setFavourite(item.favourite);
    } else if (isNew) {
      filled.current = true;
    }
  }, [loaded, item, isNew]);

  const dirty = useMemo(() => {
    if (isNew) return !!(title || url || username || password || notes);
    if (!item) return false;
    return item.title !== title || item.url !== url || item.username !== username || item.password !== password || item.notes !== notes || item.category !== category || item.favourite !== favourite;
  }, [isNew, item, title, url, username, password, notes, category, favourite]);

  const score = passwordScore(password);
  const scoreLabel = [t('Very weak'), t('Weak'), t('Okay'), t('Strong'), t('Very strong')][score];
  const scoreColor = [c.danger, c.danger, c.orange, c.success, c.success][score];

  const leave = () => (dirty ? setDiscardOpen(true) : goBack('/(tabs)/vault'));

  if (!unlocked) {
    return (
      <Screen header={{ title: isNew ? t('New login') : t('Login'), onBack: () => goBack('/(tabs)/vault') }} scroll={false}>
        <VaultLock pinSet={pinSet} />
      </Screen>
    );
  }
  if (!isNew && loaded && !item) {
    return (
      <Screen header={{ title: t('Login'), onBack: () => goBack('/(tabs)/vault') }}>
        <EmptyState icon="key-remove" title={t('Login not found')} message={t('It may have been deleted.')} actionLabel={t('Back')} onAction={() => goBack('/(tabs)/vault')} />
      </Screen>
    );
  }

  const save = async () => {
    const name = title.trim() || url.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0].trim() || username.trim();
    if (!name) {
      toast.error(t('Give this login a name'));
      return;
    }
    setSaving(true);
    try {
      const patch = { title: name, url: url.trim(), username: username.trim(), password, notes, category, favourite };
      if (isNew) await addVaultItem(patch);
      else await updateVaultItem(id, patch);
      haptic('success');
      toast.success(t('Login saved'));
      goBack('/(tabs)/vault');
    } finally {
      setSaving(false);
    }
  };

  const openGenerator = () => {
    setPreview(generatePassword(gen));
    setGenOpen(true);
  };
  const setOpt = (patch: Partial<GenOptions>) => {
    const next = { ...gen, ...patch };
    setGen(next);
    setPreview(generatePassword(next));
  };

  const openSite = async () => {
    const target = normaliseUrl(url);
    try {
      await Linking.openURL(target);
    } catch {
      toast.error(t('Could not open the link'));
    }
  };

  return (
    <Screen
      header={{
        title: isNew ? t('New login') : title || t('Login'),
        onBack: leave,
        right: (
          <IconButton
            icon={favourite ? 'star' : 'star-outline'}
            label={t('Favourite')}
            bg={favourite ? c.primary : undefined}
            color={favourite ? '#111' : undefined}
            onPress={() => {
              touchVault();
              setFavourite(!favourite);
            }}
          />
        ),
      }}
      keyboard
      footer={<Button label={t('Save')} icon="check" onPress={() => void save()} loading={saving} disabled={!dirty} />}
    >
      <Field label={t('Name')} icon="tag-outline" value={title} onChangeText={(v) => { touchVault(); setTitle(v); }} placeholder={t('e.g. Gmail')} autoCapitalize="words" />
      <View style={{ height: 14 }} />
      <Field
        label={t('Website')}
        icon="web"
        value={url}
        onChangeText={(v) => { touchVault(); setUrl(v); }}
        placeholder="https://example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        right={
          url.trim() ? (
            <Pressable hitSlop={10} onPress={() => void openSite()} accessibilityLabel={t('Open website')}>
              <Icon name="open-in-new" size={22} color={c.ink} />
            </Pressable>
          ) : undefined
        }
      />
      <View style={{ height: 14 }} />
      <Field
        label={t('ID / Username / E-mail')}
        icon="account-outline"
        value={username}
        onChangeText={(v) => { touchVault(); setUsername(v); }}
        placeholder="name@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        right={
          username ? (
            <Pressable hitSlop={10} onPress={() => void copyPlain(username, t('Username'))} accessibilityLabel={t('Copy username')}>
              <Icon name="content-copy" size={22} color={c.ink} />
            </Pressable>
          ) : undefined
        }
      />
      <View style={{ height: 14 }} />
      <Field
        label={t('Password')}
        icon="key-outline"
        value={password}
        onChangeText={(v) => { touchVault(); setPassword(v); }}
        placeholder={t('Password')}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        right={
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <Pressable hitSlop={8} onPress={() => setShow(!show)} accessibilityLabel={show ? t('Hide password') : t('Show password')}>
              <Icon name={show ? 'eye-off-outline' : 'eye-outline'} size={22} color={c.muted} />
            </Pressable>
            {password ? (
              <Pressable hitSlop={8} onPress={() => void copySecret(password, t('Password'))} accessibilityLabel={t('Copy password')}>
                <Icon name="content-copy" size={22} color={c.ink} />
              </Pressable>
            ) : null}
          </View>
        }
      />
      {password ? (
        <View style={{ marginTop: 8, gap: 4 }}>
          <ProgressBar value={(score + 1) / 5} height={10} color={scoreColor} />
          <T variant="label" color={scoreColor}>
            {scoreLabel}
          </T>
        </View>
      ) : null}
      <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
        <Button small kind="light" label={t('Generate strong password')} icon="auto-fix" onPress={openGenerator} />
      </View>
      {item ? (
        <T variant="small" muted style={{ marginTop: 10 }}>
          {t('Password changed {when}', { when: relativeTime(item.passwordChangedAt) })}
        </T>
      ) : null}

      <SectionLabel>{t('Category')}</SectionLabel>
      <ChipRow>
        {VAULT_CATEGORIES.map((x) => (
          <Chip key={x.key} label={t(x.label)} icon={x.icon} selected={category === x.key} onPress={() => setCategory(x.key)} />
        ))}
      </ChipRow>

      <View style={{ height: 16 }} />
      <Field label={t('Notes')} icon="note-text-outline" value={notes} onChangeText={(v) => { touchVault(); setNotes(v); }} placeholder={t('Security questions, recovery codes…')} multiline />

      {!isNew ? (
        <>
          <SectionLabel>{t('Options')}</SectionLabel>
          <SettingGroup>
            {url.trim() ? <SettingRow icon="open-in-new" title={t('Open website')} onPress={() => void openSite()} /> : null}
            <SettingRow icon="delete-outline" iconBg={c.danger} danger title={t('Delete login')} onPress={() => setDeleteOpen(true)} last />
          </SettingGroup>
        </>
      ) : null}

      <Sheet visible={genOpen} onClose={() => setGenOpen(false)} title={t('Password generator')}>
        <Brutal bg={c.surface2} depth={3} radius={14} contentStyle={{ padding: 14 }}>
          <T variant="mono" selectable style={{ fontSize: 18 }}>
            {preview}
          </T>
        </Brutal>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
          <T variant="bodyBold" style={{ flex: 1 }}>
            {t('Length')}: {gen.length}
          </T>
          <IconButton icon="minus" label={t('Shorter')} size={40} onPress={() => setOpt({ length: Math.max(8, gen.length - 1) })} />
          <IconButton icon="plus" label={t('Longer')} size={40} onPress={() => setOpt({ length: Math.min(40, gen.length + 1) })} />
          <IconButton icon="refresh" label={t('Generate again')} size={40} bg={c.primary} color="#111" onPress={() => setPreview(generatePassword(gen))} />
        </View>
        <View style={{ marginTop: 12 }}>
          <SettingGroup>
            <SettingRow icon="format-letter-case-lower" title="a–z" chevron={false} right={<Switch value={gen.lower} onChange={(v) => setOpt({ lower: v })} />} />
            <SettingRow icon="format-letter-case-upper" title="A–Z" chevron={false} right={<Switch value={gen.upper} onChange={(v) => setOpt({ upper: v })} />} />
            <SettingRow icon="numeric" title="0–9" chevron={false} right={<Switch value={gen.digits} onChange={(v) => setOpt({ digits: v })} />} />
            <SettingRow icon="pound" title="!@#$" chevron={false} last right={<Switch value={gen.symbols} onChange={(v) => setOpt({ symbols: v })} />} />
          </SettingGroup>
        </View>
        <View style={{ height: 16 }} />
        <Button
          label={t('Use this password')}
          icon="check"
          onPress={() => {
            setPassword(preview);
            setShow(true);
            setGenOpen(false);
          }}
        />
      </Sheet>

      <Dialog
        visible={deleteOpen}
        danger
        icon="delete-outline"
        title={t('Delete this login?')}
        message={t('The saved ID and password will be removed from this phone and from your cloud account.')}
        confirmLabel={t('Delete')}
        onConfirm={() => {
          setDeleteOpen(false);
          void removeVaultItem(id).then(() => {
            toast.success(t('Login deleted'));
            goBack('/(tabs)/vault');
          });
        }}
        onCancel={() => setDeleteOpen(false)}
      />
      <Dialog
        visible={discardOpen}
        icon="close-circle-outline"
        title={t('Discard changes?')}
        message={t('You have unsaved changes to this login.')}
        confirmLabel={t('Discard')}
        onConfirm={() => {
          setDiscardOpen(false);
          goBack('/(tabs)/vault');
        }}
        onCancel={() => setDiscardOpen(false)}
      />
    </Screen>
  );
}
