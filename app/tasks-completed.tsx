import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useData } from '@/store/data';
import { toast } from '@/store/ui';
import { useT } from '@/i18n';
import { Dialog, EmptyState, IconButton, Screen, T } from '@/components/ui';
import { TaskRow } from '@/components/app/Rows';

export default function CompletedTasks() {
  const t = useT();
  const tasks = useData((s) => s.tasks);
  const [confirm, setConfirm] = useState(false);
  const done = useMemo(() => tasks.filter((x) => x.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)), [tasks]);

  return (
    <Screen
      header={{
        title: t('Completed tasks'),
        subtitle: t(done.length === 1 ? '{n} task' : '{n} tasks', { n: done.length }),
        right: done.length ? <IconButton icon="delete-sweep-outline" label={t('Clear all')} onPress={() => setConfirm(true)} /> : undefined,
      }}
    >
      {done.length === 0 ? (
        <EmptyState icon="check-circle-outline" title={t('Nothing completed yet')} message={t('Tasks you finish will be listed here.')} />
      ) : (
        <View style={{ gap: 12 }}>
          <T variant="small" muted>
            {t('Tap the checkbox to bring a task back.')}
          </T>
          {done.map((x) => (
            <TaskRow key={x.id} task={x} onToggle={() => useData.getState().toggleTask(x.id)} onPress={() => router.push(`/task/${x.id}`)} />
          ))}
        </View>
      )}
      <Dialog
        visible={confirm}
        icon="delete-sweep-outline"
        danger
        title={t('Clear completed tasks?')}
        message={t('{n} completed tasks will be permanently deleted.', { n: done.length })}
        confirmLabel={t('Clear all')}
        onConfirm={() => {
          useData.getState().clearCompletedTasks();
          setConfirm(false);
          toast.success(t('Completed tasks cleared'));
        }}
        onCancel={() => setConfirm(false)}
      />
    </Screen>
  );
}
