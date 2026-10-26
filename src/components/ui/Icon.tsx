import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  name: string;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 22, color = '#111' }: Props) {
  return <MaterialCommunityIcons name={name as IconName} size={size} color={color} />;
}
