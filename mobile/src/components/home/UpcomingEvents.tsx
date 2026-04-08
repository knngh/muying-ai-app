import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Button, Card, Chip, Text } from 'react-native-paper'
import type { CalendarEvent } from '../../api/modules'
import { StandardCard } from '../layout'
import { colors, fontSize, spacing, borderRadius, eventTypeLabels } from '../../theme'

interface UpcomingEventsProps {
  events: CalendarEvent[]
  onViewAll: () => void
}

export default function UpcomingEvents({ events, onViewAll }: UpcomingEventsProps) {
  if (events.length === 0) return null

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>近期提醒</Text>
        <Button mode="text" compact onPress={onViewAll}>
          查看全部
        </Button>
      </View>
      {events.map((event) => (
        <StandardCard key={`${event.id}-${event.eventDate}`}>
          <Card.Content style={styles.upcomingCardContent}>
            <View style={styles.upcomingMeta}>
              <Chip compact style={styles.upcomingChip} textStyle={styles.upcomingChipText}>
                {eventTypeLabels[event.eventType] || '提醒'}
              </Chip>
              <Text style={styles.upcomingDate}>{event.eventDate}</Text>
            </View>
            <Text style={styles.upcomingTitle}>{event.title}</Text>
            {event.description ? (
              <Text style={styles.upcomingDesc} numberOfLines={2}>
                {event.description}
              </Text>
            ) : null}
          </Card.Content>
        </StandardCard>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  upcomingCardContent: {
    gap: spacing.xs,
  },
  upcomingMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upcomingChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.pill,
  },
  upcomingChipText: {
    color: colors.primaryDark,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  upcomingDate: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  upcomingTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  upcomingDesc: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
})
