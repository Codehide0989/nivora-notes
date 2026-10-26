import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { useData } from '@/store/data';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';
import { useCloud } from '@/store/cloud';
import { cloudDeleteAccount } from '@/services/cloud';
import { LANGUAGES, useT } from '@/i18n';
import { toast } from '@/store/ui';
import { signOut, wipeEverything } from '@/services/account';
import { Avatar, Brutal, Button, Dialog, Field, SectionLabel, SettingGroup, SettingRow, Sheet, Switch, T } from '@/components/ui';
import { OfflineBanner } from '@/components/app/Banners';
import { TAB_BAR_SPACE } from '@/components/app/TabBar';

export default function Settings() {
  const t = useT();
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useSettings();
  const notes = useData((d) => d.notes);
  const tasks = useData((d) => d.tasks);
  const reminders = useData((d) => d.reminders);
  const pinSet = useSession((x) => x.pinSet);
  const cloudOn = useCloud((x) => x.signedIn);
  const [deletePw, setDeletePw] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(s.profileName);
  const [email, setEmail] = useState(s.profileEmail);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [clearOnLogout, setClearOnLogout] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  const trashCount = useMemo(() => notes.filter((n) => n.deletedAt !== null).length, [notes]);
  const liveCount = notes.length - trashCount;
  const language = LANGUAGES.find((l) => l.code === s.language)?.native ?? 'English';
  const themeLabel = s.theme === 'system' ? t('Auto') : s.theme === 'dark' ? t('Dark') : t('Light');

  const doLogout = async () => {
    setBusy(true);
    await signOut(clearOnLogout);
    setBusy(false);
    setLogoutOpen(false);
    router.replace('/onboarding');
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      // Signed in to the cloud: erase the encrypted copy on the server first, so nothing is left behind.
      if (cloudOn) await cloudDeleteAccount(deletePw);
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : t('Something went wrong'));
      return;
    }
    await wipeEverything();
    setBusy(false);
    setDeleteOpen(false);
    setConfirmText('');
    setDeletePw('');
    router.replace('/status/account-deleted');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OfflineBanner />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: TAB_BAR_SPACE + insets.bottom }} showsVerticalScrollIndicator={false}>
        <T variant="h1" style={{ paddingTop: 10, paddingBottom: 14 }}>
          {t('Settings')}
        </T>

        <Brutal bg={c.primary} depth={5} radius={22} onPress={() => { setName(s.profileName); setEmail(s.profileEmail); setEditOpen(true); }} accessibilityLabel={t('Edit profile')} contentStyle={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar name={s.profileName || 'N'} size={62} />
            <View style={{ flex: 1 }}>
              <T variant="h2" color="#111" numberOfLines={1}>
                {s.profileName || t('Add your name')}
              </T>
              <T variant="small" color="#111" numberOfLines={1} style={{ opacity: 0.75 }}>
                {s.profileEmail || t('Tap to edit your profile')}
              </T>
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 14, gap: 10 }}>
            {[
              [liveCount, t('Notes')],
              [tasks.length, t('Tasks')],
              [reminders.length, t('Reminders')],
            ].map(([n, l]) => (
              <View key={String(l)} style={{ flex: 1, backgroundColor: '#111', borderRadius: 12, paddingVertical: 8, alignItems: 'center' }}>
                <T variant="h2" fixed color="#FFD400">
                  {n}
                </T>
                <T variant="label" fixed color="#FFF8E1" style={{ fontSize: 10 }}>
                  {l}
                </T>
              </View>
            ))}
          </View>
        </Brutal>

        <SectionLabel>{t('Preferences')}</SectionLabel>
        <SettingGroup>
          <SettingRow icon="palette-outline" title={t('Appearance')} value={themeLabel} onPress={() => router.push('/prefs/appearance')} />
          <SettingRow icon="bell-outline" iconBg={c.orange} title={t('Notifications')} value={s.notificationsEnabled ? t('On') : t('Off')} onPress={() => router.push('/prefs/notifications')} />
          <SettingRow icon="translate" title={t('Language')} value={language} onPress={() => router.push('/prefs/language')} last />
        </SettingGroup>

        <SectionLabel>{t('Privacy & data')}</SectionLabel>
        <SettingGroup>
          <SettingRow icon="shield-lock-outline" title={t('Security')} value={pinSet ? t('PIN on') : t('Off')} onPress={() => router.push('/prefs/security')} />
          <SettingRow icon="backup-restore" iconBg={c.orange} title={t('Backup & restore')} onPress={() => router.push('/prefs/backup')} />
          <SettingRow icon="cloud-lock-outline" title={t('Cloud account')} value={cloudOn ? t('On') : t('Off')} onPress={() => router.push('/prefs/account')} />
          <SettingRow icon="cloud-sync-outline" iconBg={c.orange} title={t('Sync & offline')} value={s.offlineMode ? t('Offline') : t('Auto')} onPress={() => router.push('/prefs/sync')} />
          <SettingRow icon="delete-outline" title={t('Trash')} value={trashCount ? String(trashCount) : undefined} onPress={() => router.push('/trash')} last />
        </SettingGroup>

        <SectionLabel>{t('Support')}</SectionLabel>
        <SettingGroup>
          <SettingRow icon="help-circle-outline" title={t('Help & support')} onPress={() => router.push('/prefs/help')} />
          <SettingRow icon="information-outline" iconBg={c.orange} title={t('About Nivora Notes')} onPress={() => router.push('/prefs/about')} last />
        </SettingGroup>

        <SectionLabel>{t('Account')}</SectionLabel>
        <SettingGroup>
          <SettingRow icon="logout" title={t('Log out')} onPress={() => setLogoutOpen(true)} />
          <SettingRow icon="account-off-outline" danger title={t('Delete account')} subtitle={t('Permanently erase all data on this device')} onPress={() => setDeleteOpen(true)} last />
        </SettingGroup>
      </ScrollView>

      <Sheet visible={editOpen} onClose={() => setEditOpen(false)} title={t('Edit profile')}>
        <Field label={t('Name')} value={name} onChangeText={setName} placeholder={t('Your name')} autoCapitalize="words" maxLength={32} icon="account-outline" />
        <View style={{ height: 14 }} />
        <Field label={t('Email (optional)')} value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" icon="email-outline" />
        <View style={{ height: 20 }} />
        <Button
          label={t('Save')}
          icon="check"
          onPress={() => {
            s.set({ profileName: name.trim(), profileEmail: email.trim() });
            setEditOpen(false);
          }}
        />
      </Sheet>

      <Dialog
        visible={logoutOpen}
        icon="logout"
        title={t('Log out?')}
        message={t('You’ll return to the welcome screen. Your notes stay on this device unless you choose to remove them.')}
        confirmLabel={t('Log out')}
        loading={busy}
        onConfirm={() => void doLogout()}
        onCancel={() => setLogoutOpen(false)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <T variant="small" color="#CFC8A8" style={{ flex: 1 }}>
            {t('Also remove all notes from this device')}
          </T>
          <Switch value={clearOnLogout} onChange={setClearOnLogout} />
        </View>
      </Dialog>

      <Dialog
        visible={deleteOpen}
        icon="account-off-outline"
        danger
        title={t('Delete your account?')}
        message={t('This permanently erases every note, task, reminder, attachment and backup on this device. It cannot be undone.')}
        confirmLabel={t('Delete everything')}
        loading={busy}
        onConfirm={() => {
          if (confirmText.trim().toUpperCase() !== 'DELETE') toast.error(t('Type DELETE to confirm'));
          else if (cloudOn && !deletePw) toast.error(t('Enter your master password'));
          else void doDelete();
        }}
        onCancel={() => {
          setDeleteOpen(false);
          setConfirmText('');
          setDeletePw('');
        }}
      >
        <View style={{ marginTop: 16, gap: 12 }}>
          <Field value={confirmText} onChangeText={setConfirmText} placeholder={t('Type DELETE to confirm')} autoCapitalize="characters" autoCorrect={false} />
          {cloudOn ? (
            <>
              <T variant="small" color="#CFC8A8">
                {t('Your cloud account and its encrypted data will be deleted too.')}
              </T>
              <Field value={deletePw} onChangeText={setDeletePw} placeholder={t('Master password')} secureTextEntry autoCapitalize="none" autoCorrect={false} />
            </>
          ) : null}
        </View>
      </Dialog>
    </View>
  );
}
