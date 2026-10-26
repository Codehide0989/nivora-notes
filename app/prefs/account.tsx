import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { useCloud } from '@/store/cloud';
import { toast } from '@/store/ui';
import { useT } from '@/i18n';
import { API_URL } from '@/config';
import { cloudDeleteAccount, cloudPendingCount, cloudSignIn, cloudSignOut } from '@/services/cloud';
import { ApiError, checkServer, isServerConfigured, serverBase, validateServerUrl } from '@/services/cloudApi';
import { passwordScore } from '@/services/crypto';
import { haptic } from '@/services/haptics';
import { relativeTime } from '@/utils/date';
import { Brutal, Button, Dialog, Field, Icon, ProgressBar, Screen, SectionLabel, Segmented, SettingGroup, SettingRow, Switch, T } from '@/components/ui';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function Info({ icon, children }: { icon: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Icon name={icon} size={18} color={c.ink} />
      <T variant="small" style={{ flex: 1 }}>
        {children as string}
      </T>
    </View>
  );
}

function Chip({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 2, borderColor: '#111', backgroundColor: 'rgba(255,255,255,0.45)' }}>
      <Icon name={icon} size={14} color="#111" />
      <T variant="label" color="#111" fixed style={{ fontSize: 11 }}>
        {label}
      </T>
    </View>
  );
}

const LOCAL_HOST = /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+)(:|\/|$)/i;

function PasswordField(props: React.ComponentProps<typeof Field>) {
  const { c } = useTheme();
  const [show, setShow] = useState(false);
  return (
    <Field
      {...props}
      secureTextEntry={!show}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="off"
      right={
        <Pressable onPress={() => setShow(!show)} hitSlop={10} accessibilityLabel={show ? 'Hide password' : 'Show password'}>
          <Icon name={show ? 'eye-off-outline' : 'eye-outline'} size={22} color={c.muted} />
        </Pressable>
      }
    />
  );
}

export default function Account() {
  const t = useT();
  const { c } = useTheme();
  const cloud = useCloud();
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [email, setEmail] = useState(cloud.email);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ack, setAck] = useState(false);
  const [server, setServer] = useState(cloud.serverUrl || API_URL);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState('');
  const [probe, setProbe] = useState<{ ok: boolean; message: string } | null>(null);
  const [probing, setProbing] = useState(false);

  const testServer = async () => {
    setProbing(true);
    setProbe(null);
    setProbe(await checkServer(server.trim()));
    setProbing(false);
  };

  const score = passwordScore(password);
  const scoreLabel = [t('Very weak'), t('Weak'), t('Okay'), t('Strong'), t('Very strong')][score];
  const scoreColor = [c.danger, c.danger, c.orange, c.success, c.success][score];

  const saveServer = (): boolean => {
    const v = server.trim().replace(/\/+$/, '');
    const bad = v ? validateServerUrl(v) : null;
    if (bad) {
      setError(t(bad));
      return false;
    }
    cloud.set({ serverUrl: v === API_URL ? '' : v });
    return true;
  };

  const submit = async () => {
    setError(null);
    if (!saveServer()) return;
    if (!serverBase()) return setError(t('Add your server address first.'));
    if (!EMAIL_RE.test(email.trim())) return setError(t('Enter a valid e-mail address.'));
    if (mode === 'register') {
      if (password.length < 10) return setError(t('Use at least 10 characters for the master password.'));
      if (score < 2) return setError(t('That master password is too easy to guess.'));
      if (password !== confirm) return setError(t('The passwords don’t match.'));
      if (!ack) return setError(t('Please confirm you understand the master password can’t be reset.'));
    } else if (!password) return setError(t('Enter your master password.'));

    setBusy(true);
    setStage(t('Securing your account…'));
    try {
      await cloudSignIn(mode, email, password);
      setPassword('');
      setConfirm('');
      haptic('success');
      toast.success(mode === 'register' ? t('Account created') : t('Signed in'));
      router.replace('/syncing');
    } catch (e) {
      haptic('error');
      setError(e instanceof ApiError ? t(e.message) : t('Something went wrong'));
    } finally {
      setBusy(false);
      setStage('');
    }
  };

  const doSignOut = async () => {
    setBusy(true);
    await cloudSignOut();
    setBusy(false);
    setSignOutOpen(false);
    toast.success(t('Signed out. Your notes stay on this device.'));
  };

  const doDelete = async () => {
    if (!deletePw) return;
    setBusy(true);
    try {
      await cloudDeleteAccount(deletePw);
      setDeleteOpen(false);
      setDeletePw('');
      toast.success(t('Cloud account deleted'));
    } catch (e) {
      toast.error(e instanceof ApiError ? t(e.message) : t('Something went wrong'));
    } finally {
      setBusy(false);
    }
  };

  if (cloud.signedIn) {
    const pending = cloudPendingCount();
    return (
      <Screen header={{ title: t('Cloud account'), subtitle: t('End-to-end encrypted sync') }}>
        <Brutal bg={c.primary} depth={5} radius={22} contentStyle={{ padding: 18, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name="cloud-lock-outline" size={42} color="#111" />
            <View style={{ flex: 1 }}>
              <T variant="h2" color="#111" numberOfLines={1}>
                {cloud.email}
              </T>
              <T variant="small" color="#111" style={{ opacity: 0.8 }}>
                {cloud.lastSyncAt ? t('Last synced {when}', { when: relativeTime(cloud.lastSyncAt) }) : t('Never synced')}
                {pending > 0 ? ` · ${t('{n} changes waiting', { n: pending })}` : ''}
              </T>
            </View>
          </View>
        </Brutal>

        <SectionLabel>{t('Sync')}</SectionLabel>
        <SettingGroup>
          <SettingRow icon="sync" title={t('Sync now')} onPress={() => router.push('/syncing')} />
          <SettingRow icon="server-network" iconBg={c.orange} title={t('Server')} subtitle={serverBase() || t('Not set')} chevron={false} last />
        </SettingGroup>

        <SectionLabel>{t('What is synced')}</SectionLabel>
        <Brutal depth={3} radius={16} contentStyle={{ padding: 14, gap: 10 }}>
          <Info icon="check-circle-outline">{t('Notes, tasks, categories, reminders and your Vault passwords — encrypted on this phone before they are uploaded.')}</Info>
          <Info icon="image-off-outline">{t('Photos and voice recordings stay on the device they were made on.')}</Info>
          <Info icon="eye-off-outline">{t('The server only stores scrambled data. It cannot read your notes or passwords, and neither can we.')}</Info>
        </Brutal>

        <SectionLabel>{t('Account')}</SectionLabel>
        <SettingGroup>
          <SettingRow icon="logout" title={t('Sign out of this device')} onPress={() => setSignOutOpen(true)} />
          <SettingRow icon="cloud-off-outline" danger title={t('Delete cloud account')} subtitle={t('Removes all encrypted data from the server')} onPress={() => setDeleteOpen(true)} last />
        </SettingGroup>

        <Dialog
          visible={signOutOpen}
          icon="logout"
          title={t('Sign out of cloud sync?')}
          message={t('Your notes and passwords stay on this phone, but they will stop syncing until you sign in again.')}
          confirmLabel={t('Sign out')}
          loading={busy}
          onConfirm={() => void doSignOut()}
          onCancel={() => setSignOutOpen(false)}
        />
        <Dialog
          visible={deleteOpen}
          icon="cloud-off-outline"
          danger
          title={t('Delete cloud account?')}
          message={t('Everything stored on the server is erased and other devices stop syncing. Data on this phone is kept. Enter your master password to confirm.')}
          confirmLabel={t('Delete')}
          loading={busy}
          onConfirm={() => void doDelete()}
          onCancel={() => {
            setDeleteOpen(false);
            setDeletePw('');
          }}
        >
          <View style={{ marginTop: 16 }}>
            <PasswordField value={deletePw} onChangeText={setDeletePw} placeholder={t('Master password')} />
          </View>
        </Dialog>
      </Screen>
    );
  }

  const configured = isServerConfigured();
  return (
    <Screen
      header={{ title: t('Cloud account'), subtitle: t('End-to-end encrypted sync') }}
      footer={<Button label={busy ? stage : mode === 'register' ? t('Create account') : t('Sign in')} icon={mode === 'register' ? 'account-plus-outline' : 'login'} onPress={() => void submit()} loading={busy} />}
    >
      <Brutal bg={c.primary} depth={5} radius={22} contentStyle={{ padding: 16, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name="shield-lock-outline" size={40} color="#111" />
          <T variant="h2" color="#111" style={{ flex: 1 }}>
            {t('Sync everywhere, readable only by you')}
          </T>
        </View>
        <T variant="small" color="#111" style={{ opacity: 0.85 }}>
          {t('Your notes and passwords are encrypted on this phone with a key made from your master password. The server never sees the password or the key.')}
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          <Chip icon="lock-outline" label={t('Encrypted on device')} />
          <Chip icon="eye-off-outline" label={t('Zero-knowledge')} />
          <Chip icon="cloud-check-outline" label={t('Multi-device')} />
        </View>
      </Brutal>

      <View style={{ height: 16 }} />
      <Segmented
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
        options={[
          { key: 'register', label: t('Create account'), icon: 'account-plus-outline' },
          { key: 'login', label: t('Sign in'), icon: 'login' },
        ]}
      />

      <View style={{ height: 16 }} />
      <Field label={t('Server address')} icon="server-network" value={server} onChangeText={setServer} placeholder="https://sync.example.com" autoCapitalize="none" autoCorrect={false} keyboardType="url" onBlur={() => void saveServer()} />
      {LOCAL_HOST.test(server.trim()) ? (
        <View style={{ marginTop: 8 }}>
          <Brutal bg={c.orange} depth={3} radius={14} contentStyle={{ padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="alert-outline" size={20} color="#111" />
            <T variant="small" color="#111" style={{ flex: 1 }}>
              {t('“localhost” means this phone itself, not your computer. Use your computer’s Wi-Fi address instead, for example http://192.168.1.42:8787, or your deployed https:// server.')}
            </T>
          </Brutal>
        </View>
      ) : null}
      <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          onPress={() => void testServer()}
          disabled={probing || !server.trim()}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 2.5, borderColor: c.line, opacity: probing || !server.trim() ? 0.5 : 1 }}
        >
          <Icon name={probing ? 'timer-sand' : 'lan-connect'} size={18} color={c.ink} />
          <T variant="label">{probing ? t('Testing…') : t('Test connection')}</T>
        </Pressable>
        {probe ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name={probe.ok ? 'check-circle-outline' : 'close-circle-outline'} size={18} color={probe.ok ? c.success : c.danger} />
            <T variant="small" color={probe.ok ? c.success : c.danger} style={{ flex: 1 }}>
              {t(probe.message)}
            </T>
          </View>
        ) : null}
      </View>
      {!configured && !server.trim() ? (
        <T variant="small" muted style={{ marginTop: 6 }}>
          {t('Deploy the sync server from the /server folder, then paste its https address here.')}
        </T>
      ) : null}

      <View style={{ height: 14 }} />
      <Field label={t('E-mail')} icon="email-outline" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
      <View style={{ height: 14 }} />
      <PasswordField label={t('Master password')} icon="key-outline" value={password} onChangeText={setPassword} placeholder={mode === 'register' ? t('At least 10 characters') : t('Your master password')} />
      {mode === 'register' ? (
        <>
          {password ? (
            <View style={{ marginTop: 8, gap: 4 }}>
              <ProgressBar value={(score + 1) / 5} height={10} color={scoreColor} />
              <T variant="label" color={scoreColor}>
                {scoreLabel}
              </T>
            </View>
          ) : null}
          <View style={{ height: 14 }} />
          <PasswordField label={t('Confirm master password')} icon="key-outline" value={confirm} onChangeText={setConfirm} placeholder={t('Type it again')} />
          <View style={{ height: 16 }} />
          <Brutal depth={3} radius={16} contentStyle={{ padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <T variant="small" style={{ flex: 1 }}>
              {t('I understand the master password can’t be reset. If I forget it, my cloud data can’t be recovered.')}
            </T>
            <Switch value={ack} onChange={setAck} />
          </Brutal>
        </>
      ) : null}

      {error ? (
        <View style={{ marginTop: 14, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Icon name="alert-circle-outline" size={20} color={c.danger} />
          <T variant="small" color={c.danger} style={{ flex: 1 }}>
            {error}
          </T>
        </View>
      ) : null}
      {busy ? (
        <T variant="small" muted style={{ marginTop: 12 }}>
          {t('This takes a few seconds on purpose — it makes your password much harder to crack.')}
        </T>
      ) : null}
      <T variant="small" muted style={{ marginTop: 16 }}>
        {t('Notes already on this phone are uploaded (encrypted) to this account.')}
      </T>
    </Screen>
  );
}
