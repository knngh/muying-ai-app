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
        <Button mode="text" textColor={colors.primaryDark} compact onPress={onViewAll}>
          查看全部
        </Button>
      </View>
      {events.map((event) => (
        <StandardCard key={`${event.id}-${event.eventDate}`} style={styles.upcomingCard}>
          <Card.Content style={styles.upcomingCardContent}>
            <View style={styles.upcomingWash} />
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
    overflow: 'hidden',
  },
  upcomingCard: {
    backgroundColor: colors.surfaceRaised,
    borderColor: 'rgba(184,138,72,0.14)',
  },
  upcomingWash: {
    position: 'absolute',
    top: -12,
    right: -8,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(220,236,238,0.22)',
  },
  upcomingMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upcomingChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(248, 230, 213, 0.9)',
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
    letterSpacing: 0.4,
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
