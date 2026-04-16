export type StandardScheduleItemStatus = 'scheduled' | 'completed' | 'due' | 'upcoming' | 'overdue';

export interface StandardScheduleItem {
  key: string;
  title: string;
  description: string;
  eventType: 'checkup' | 'vaccine' | 'reminder';
  eventDate: string;
  dateLabel: string;
  sourceLabel: string;
  status: StandardScheduleItemStatus;
  statusLabel: string;
  isGenerated: boolean;
  eventId?: number;
}

export interface StandardSchedulePlan {
  available: boolean;
  lifecycleKey: string;
  title: string;
  subtitle: string;
  summary: string;
  generatedCount: number;
  pendingCount: number;
  items: StandardScheduleItem[];
}

export interface StandardScheduleGenerateResult {
  createdCount: number;
  createdEventIds: number[];
  plan: StandardSchedulePlan;
}
