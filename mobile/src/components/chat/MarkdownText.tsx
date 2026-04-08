import React from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, spacing, borderRadius } from '../../theme'

interface MarkdownTextProps {
  children: string
}

interface ParsedBlock {
  type: 'heading' | 'code_block' | 'ordered_list' | 'unordered_list' | 'paragraph'
  level?: number
  language?: string
  items?: string[]
  content?: string
}

function parseBlocks(text: string): ParsedBlock[] {
  const lines = text.split('\n')
  const blocks: ParsedBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code block
    if (line.startsWith('```')) {
      const language = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push({ type: 'code_block', language, content: codeLines.join('\n') })
      i++ // skip closing ```
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, content: headingMatch[2] })
      i++
      continue
    }

    // Unordered list
    if (/^[\-\*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[\-\*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[\-\*]\s+/, ''))
        i++
      }
      blocks.push({ type: 'unordered_list', items })
      continue
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push({ type: 'ordered_list', items })
      continue
    }

    // Empty line — skip
    if (line.trim() === '') {
      i++
      continue
    }

    // Paragraph: collect consecutive non-special lines
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('```') &&
      !lines[i].match(/^#{1,3}\s+/) &&
      !lines[i].match(/^[\-\*]\s+/) &&
      !lines[i].match(/^\d+\.\s+/)
    ) {
      paraLines.push(lines[i])
      i++
    }
    blocks.push({ type: 'paragraph', content: paraLines.join('\n') })
  }

  return blocks
}

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Match: **bold**, *italic*, `code`
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    if (match[2]) {
      // bold
      nodes.push(<Text key={match.index} style={styles.bold}>{match[2]}</Text>)
    } else if (match[3]) {
      // italic
      nodes.push(<Text key={match.index} style={styles.italic}>{match[3]}</Text>)
    } else if (match[4]) {
      // inline code
      nodes.push(<Text key={match.index} style={styles.inlineCode}>{match[4]}</Text>)
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

export default function MarkdownText({ children }: MarkdownTextProps) {
  const blocks = parseBlocks(children)

  return (
    <View>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading': {
            const headingStyle =
              block.level === 1
                ? styles.h1
                : block.level === 2
                  ? styles.h2
                  : styles.h3
            return (
              <Text key={index} style={headingStyle}>
                {renderInline(block.content!)}
              </Text>
            )
          }

          case 'code_block':
            return (
              <View key={index} style={styles.codeBlock}>
                <Text style={styles.codeBlockText}>{block.content}</Text>
              </View>
            )

          case 'unordered_list':
            return (
              <View key={index} style={styles.list}>
                {block.items!.map((item, idx) => (
                  <View key={idx} style={styles.listItem}>
                    <Text style={styles.bullet}>{'\u2022'} </Text>
                    <Text style={styles.listItemText}>{renderInline(item)}</Text>
                  </View>
                ))}
              </View>
            )

          case 'ordered_list':
            return (
              <View key={index} style={styles.list}>
                {block.items!.map((item, idx) => (
                  <View key={idx} style={styles.listItem}>
                    <Text style={styles.bullet}>{idx + 1}. </Text>
                    <Text style={styles.listItemText}>{renderInline(item)}</Text>
                  </View>
                ))}
              </View>
            )

          case 'paragraph':
          default:
            return (
              <Text key={index} style={styles.paragraph}>
                {renderInline(block.content!)}
              </Text>
            )
        }
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  h1: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  h2: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  h3: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  paragraph: {
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  inlineCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: fontSize.sm,
    backgroundColor: colors.background,
    borderRadius: 4,
    paddingHorizontal: 4,
    color: colors.primaryDark,
  },
  codeBlock: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginVertical: spacing.xs,
  },
  codeBlockText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.text,
  },
  list: {
    marginBottom: spacing.xs,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  bullet: {
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.text,
    width: 20,
  },
  listItemText: {
    flex: 1,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.text,
  },
})
