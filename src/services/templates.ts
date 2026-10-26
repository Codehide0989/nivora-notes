import { tNow as t } from '@/i18n';
import type { NoteColor, NoteKind } from '@/types';

export interface Template {
  id: string;
  icon: string;
  color: NoteColor;
  name: string;
  description: string;
  title: string;
  body: string;
  kind: NoteKind;
  categoryId?: string;
}

const today = () =>
  new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

export function getTemplates(): Template[] {
  return [
    {
      id: 'meeting',
      icon: 'account-group-outline',
      color: 'sky',
      name: t('Meeting notes'),
      description: t('Agenda, decisions, action items'),
      title: t('Team meeting'),
      kind: 'note',
      categoryId: 'cat-work',
      body: `## ${t('Attendees')}\n- \n\n## ${t('Agenda')}\n1. \n\n## ${t('Decisions')}\n- \n\n## ${t('Action items')}\n- [ ] \n- [ ] `,
    },
    {
      id: 'travel',
      icon: 'airplane',
      color: 'orange',
      name: t('Travel plan'),
      description: t('Itinerary, bookings, packing'),
      title: t('Travel plan'),
      kind: 'note',
      categoryId: 'cat-travel',
      body: `## ${t('Itinerary')}\n- ${t('Day')} 1: \n- ${t('Day')} 2: \n\n## ${t('Bookings')}\n- [ ] ${t('Flights')}\n- [ ] ${t('Hotel')}\n\n## ${t('Packing list')}\n- [ ] ${t('Passport & documents')}\n- [ ] ${t('Charger')}\n- [ ] ${t('Clothes')}`,
    },
    {
      id: 'project',
      icon: 'lightbulb-on-outline',
      color: 'yellow',
      name: t('Project idea'),
      description: t('Problem, solution, next steps'),
      title: t('Project idea'),
      kind: 'note',
      categoryId: 'cat-ideas',
      body: `## ${t('The idea')}\n\n## ${t('Why it matters')}\n- \n\n## ${t('First steps')}\n- [ ] \n- [ ] \n\n## ${t('Resources')}\n`,
    },
    {
      id: 'shopping',
      icon: 'cart-outline',
      color: 'mint',
      name: t('Shopping list'),
      description: t('Tick items off as you go'),
      title: t('Shopping list'),
      kind: 'checklist',
      categoryId: 'cat-shopping',
      body: `- [ ] \n- [ ] \n- [ ] `,
    },
    {
      id: 'journal',
      icon: 'book-heart-outline',
      color: 'pink',
      name: t('Daily journal'),
      description: t('Gratitude, wins, tomorrow'),
      title: today(),
      kind: 'note',
      categoryId: 'cat-personal',
      body: `## ${t('Grateful for')}\n- \n\n## ${t('Today’s wins')}\n- \n\n## ${t('Tomorrow')}\n- [ ] `,
    },
    {
      id: 'weekly',
      icon: 'calendar-check-outline',
      color: 'violet',
      name: t('Weekly planner'),
      description: t('Goals and a plan for each day'),
      title: t('Weekly planner'),
      kind: 'note',
      body: `## ${t('Top 3 goals')}\n1. \n2. \n3. \n\n## ${t('Plan')}\n- ${t('Mon')}: \n- ${t('Tue')}: \n- ${t('Wed')}: \n- ${t('Thu')}: \n- ${t('Fri')}: \n- ${t('Weekend')}: `,
    },
  ];
}
