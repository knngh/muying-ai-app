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
    marginBottom: spacing.xs + 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  upcomingCardContent: {
    gap: 3,
    overflow: 'hidden',
  },
  upcomingCard: {
    backgroundColor: colors.surfaceRaised,
    borderColor: 'rgba(184,138,72,0.14)',
  },
  upcomingWash: {
    position: 'absolute',
    top: -14,
    right: -10,
    width: 60,
    height: 60,
    borderRadius: 30,
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
    fontSize: 10,
    fontWeight: '600',
  },
  upcomingDate: {
    color: colors.textSecondary,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  upcomingTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  upcomingDesc: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
})
