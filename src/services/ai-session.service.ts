import prisma from '../config/database';
import type { SourceReference } from './knowledge.service';

export interface StoredChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isEmergency?: boolean;
  sources?: SourceReference[];
  createdAt: string;
}

export interface StoredChatSession {
  id: string;
  title?: string;
  summary?: string;
  messageCount: number;
  lastMessagePreview?: string;
  messages: StoredChatMessage[];
  createdAt: string;
  updatedAt: string;
}

interface ConversationRow {
  id: bigint;
  title: string | null;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
  messageCount: bigint | number;
}

interface MessageRow {
  id: bigint;
  role: string;
  content: string;
  isEmergency: number;
  sourcesJson: string | null;
  createdAt: Date;
}

let ensureTablesPromise: Promise<void> | null = null;

type DbExecutor = Pick<typeof prisma, '$executeRawUnsafe' | '$queryRawUnsafe'>;

function truncateText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^>\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1');
}

function extractConversationTitle(question: string): string {
  const cleaned = question
    .replace(/^问题描述[:：]*/u, '')
    .replace(/^全部症状[:：]*/u, '')
    .replace(/^患者信息[:：][^我你他她它]*?/u, '')
    .replace(/发病时间及原因[:：].*$/u, '')
    .replace(/治疗情况[:：].*$/u, '')
    .replace(/曾经治疗情况及是否有过敏、遗传病史[:：].*$/u, '')
    .replace(/\s+/g, ' ')
    .trim();

  const clauses = cleaned
    .split(/[，,。！？；;!?]/u)
    .map((part) => part.trim())
    .filter(Boolean);

  const firstClause = clauses[0] || cleaned;
  const secondClause = clauses[1];
  const title = /^我怀孕\d|^怀孕\d|^我现在怀孕/u.test(firstClause) && secondClause
    ? `${firstClause}，${secondClause}`
    : firstClause;

  return truncateText(title || cleaned || question, 28);
}

function extractSummary(answer: string, fallbackQuestion: string): string {
  const normalized = stripMarkdown(answer)
    .replace(/⚠️\s*免责声明.*$/u, '')
    .replace(/（免责声明.*$/u, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return truncateText(fallbackQuestion, 120);
  }

  const summaryBody = normalized
    .replace(/^简洁要点[:：]\s*/u, '')
    .replace(/^简洁答案要点[:：]\s*/u, '')
    .replace(/^孕晚期轻微水肿的注意事项要点[:：]\s*/u, '')
    .trim();

  const sentences = summaryBody
    .split(/[。！？]/u)
    .map((part) => part.trim())
    .filter(Boolean);

  const summary = sentences.slice(0, 2).join('，') || summaryBody;
  return truncateText(summary, 120);
}

function normalizeStoredSummary(summary?: string | null): string | undefined {
  if (!summary) {
    return undefined;
  }

  const cleaned = stripMarkdown(summary)
    .replace(/⚠️\s*免责声明.*$/u, '')
    .replace(/（免责声明.*$/u, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || undefined;
}

function parseSources(value: string | null): SourceReference[] | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value) as SourceReference[];
  } catch {
    return undefined;
  }
}

function mapMessageRow(row: MessageRow): StoredChatMessage {
  return {
    id: row.id.toString(),
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.content,
    isEmergency: Boolean(row.isEmergency),
    sources: parseSources(row.sourcesJson),
    createdAt: row.createdAt.toISOString(),
  };
}

async function ensureTables(): Promise<void> {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ai_chat_conversations (
          id BIGINT NOT NULL AUTO_INCREMENT,
          user_id BIGINT NOT NULL,
          title VARCHAR(160) NULL,
          summary VARCHAR(500) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deleted_at DATETIME NULL,
          PRIMARY KEY (id),
          KEY idx_ai_chat_conversations_user (user_id),
          KEY idx_ai_chat_conversations_updated (updated_at),
          KEY idx_ai_chat_conversations_deleted (deleted_at),
          CONSTRAINT fk_ai_chat_conversations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ai_chat_messages (
          id BIGINT NOT NULL AUTO_INCREMENT,
          conversation_id BIGINT NOT NULL,
          role VARCHAR(20) NOT NULL,
          content LONGTEXT NOT NULL,
          is_emergency TINYINT(1) NOT NULL DEFAULT 0,
          sources_json LONGTEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_ai_chat_messages_conversation (conversation_id),
          KEY idx_ai_chat_messages_created (created_at),
          CONSTRAINT fk_ai_chat_messages_conversation FOREIGN KEY (conversation_id) REFERENCES ai_chat_conversations(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    })();
  }

  return ensureTablesPromise;
}

async function createConversation(
  tx: DbExecutor,
  userId: string,
  title: string,
  summary?: string
): Promise<string> {
  await tx.$executeRawUnsafe(
    'INSERT INTO ai_chat_conversations (user_id, title, summary) VALUES (?, ?, ?)',
    userId,
    title,
    summary || null
  );

  const rows = await tx.$queryRawUnsafe<Array<{ id: bigint }>>('SELECT LAST_INSERT_ID() AS id');
  return rows[0].id.toString();
}

async function insertMessage(
  tx: DbExecutor,
  conversationId: string,
  message: {
    role: 'user' | 'assistant';
    content: string;
    isEmergency?: boolean;
    sources?: SourceReference[];
  }
): Promise<void> {
  await tx.$executeRawUnsafe(
    'INSERT INTO ai_chat_messages (conversation_id, role, content, is_emergency, sources_json) VALUES (?, ?, ?, ?, ?)',
    conversationId,
    message.role,
    message.content,
    message.isEmergency ? 1 : 0,
    message.sources ? JSON.stringify(message.sources) : null
  );
}

export async function initializeAIChatStorage(): Promise<void> {
  await ensureTables();
}

export async function ensureConversationOwnership(userId: string, conversationId: string): Promise<boolean> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
    `SELECT id
     FROM ai_chat_conversations
     WHERE id = ? AND user_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    conversationId,
    userId
  );

  return rows.length > 0;
}

export async function saveConversationExchange(params: {
  userId: string;
  conversationId?: string;
  userQuestion: string;
  assistantAnswer: string;
  isEmergency?: boolean;
  sources?: SourceReference[];
}): Promise<string> {
  await ensureTables();

  const title = extractConversationTitle(params.userQuestion);
  const summary = extractSummary(params.assistantAnswer, params.userQuestion);

  return prisma.$transaction(async (tx) => {
    let conversationId = params.conversationId;

    if (!conversationId || !(await ensureConversationOwnership(params.userId, conversationId))) {
      conversationId = await createConversation(tx, params.userId, title, summary);
    } else {
      await tx.$executeRawUnsafe(
        'UPDATE ai_chat_conversations SET title = COALESCE(title, ?), summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        title,
        summary,
        conversationId,
        params.userId
      );
    }

    await insertMessage(tx, conversationId, {
      role: 'user',
      content: params.userQuestion,
    });

    await insertMessage(tx, conversationId, {
      role: 'assistant',
      content: params.assistantAnswer,
      isEmergency: params.isEmergency,
      sources: params.sources,
    });

    await tx.$executeRawUnsafe(
      'UPDATE ai_chat_conversations SET summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      summary,
      conversationId
    );

    return conversationId;
  });
}

export async function listUserChatSessions(userId: string, limit = 20): Promise<StoredChatSession[]> {
  await ensureTables();
  const safeLimit = Math.min(Math.max(limit, 1), 50);

  const rows = await prisma.$queryRawUnsafe<ConversationRow[]>(
    `SELECT c.id, c.title, c.summary, c.created_at AS createdAt, c.updated_at AS updatedAt, COUNT(m.id) AS messageCount
     FROM ai_chat_conversations c
     LEFT JOIN ai_chat_messages m ON m.conversation_id = c.id
     WHERE c.user_id = ? AND c.deleted_at IS NULL
     GROUP BY c.id, c.title, c.summary, c.created_at, c.updated_at
     ORDER BY c.updated_at DESC
     LIMIT ?`,
    userId,
    safeLimit
  );

  return rows.map((row) => ({
    id: row.id.toString(),
    title: row.title || '新的对话',
    summary: normalizeStoredSummary(row.summary),
    lastMessagePreview: normalizeStoredSummary(row.summary),
    messageCount: Number(row.messageCount),
    messages: [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getUserChatSession(userId: string, conversationId: string): Promise<StoredChatSession | null> {
  await ensureTables();
  const sessionRows = await prisma.$queryRawUnsafe<ConversationRow[]>(
    `SELECT c.id, c.title, c.summary, c.created_at AS createdAt, c.updated_at AS updatedAt, COUNT(m.id) AS messageCount
     FROM ai_chat_conversations c
     LEFT JOIN ai_chat_messages m ON m.conversation_id = c.id
     WHERE c.id = ? AND c.user_id = ? AND c.deleted_at IS NULL
     GROUP BY c.id, c.title, c.summary, c.created_at, c.updated_at
     LIMIT 1`,
    conversationId,
    userId
  );

  if (sessionRows.length === 0) {
    return null;
  }

  const messageRows = await prisma.$queryRawUnsafe<MessageRow[]>(
    `SELECT id, role, content, is_emergency AS isEmergency, sources_json AS sourcesJson, created_at AS createdAt
     FROM ai_chat_messages
     WHERE conversation_id = ?
     ORDER BY created_at ASC, id ASC`,
    conversationId
  );

  const session = sessionRows[0];
  return {
    id: session.id.toString(),
    title: session.title || '新的对话',
    summary: normalizeStoredSummary(session.summary),
    lastMessagePreview: normalizeStoredSummary(session.summary),
    messageCount: Number(session.messageCount),
    messages: messageRows.map(mapMessageRow),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export async function softDeleteUserChatSession(userId: string, conversationId: string): Promise<boolean> {
  await ensureTables();
  const result = await prisma.$executeRawUnsafe(
    'UPDATE ai_chat_conversations SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    conversationId,
    userId
  );

  return Number(result) > 0;
}
