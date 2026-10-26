import React from 'react';
import { Tabs } from 'expo-router';
import { TabBar } from '@/components/app/TabBar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="reminders" />
      <Tabs.Screen name="vault" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
