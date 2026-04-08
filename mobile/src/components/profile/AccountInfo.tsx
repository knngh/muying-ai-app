import React from 'react'
import { StyleSheet } from 'react-native'
import { List, Text } from 'react-native-paper'
import { StandardCard } from '../layout'
import { colors, fontSize } from '../../theme'

interface AccountInfoProps {
  rows: Array<{ label: string; value: string }>
  onPress: () => void
}

export default function AccountInfo({ rows, onPress }: AccountInfoProps) {
  return (
    <StandardCard>
      <List.Section style={styles.listSection}>
        {rows.map((row) => (
          <List.Item
            key={row.label}
            title={row.label}
            description={row.value}
            titleStyle={styles.listItemTitle}
            descriptionStyle={styles.listItemDescription}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={onPress}
          />
        ))}
      </List.Section>
    </StandardCard>
  )
}

const styles = StyleSheet.create({
  listSection: {
    marginVertical: 0,
  },
  listItemTitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  listItemDescription: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
    marginTop: 2,
  },
})
