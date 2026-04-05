import prisma from '../config/database';
import { callAIGateway } from './ai-gateway.service';
import { analyzeCommunityContent } from './community-moderation.service';

export type CommunityReportAction = 'none' | 'hide_post' | 'delete_comment';
export type CommunityReportDecision = 'pending' | 'reviewed' | 'rejected';

type ReviewInput = {
  targetType: 'post' | 'comment';
  reason: string;
  reportDescription?: string | null;
  targetTitle?: string | null;
  targetContent: string;
};

type ReviewOutput = {
  status: CommunityReportDecision;
  actionTaken: CommunityReportAction;
  decisionReason: string;
  handledByAI: boolean;
};

function normalizeAction(
  targetType: 'post' | 'comment',
  status: CommunityReportDecision,
  actionTaken: string
): CommunityReportAction {
  if (status !== 'reviewed') {
    return 'none';
  }

  if (targetType === 'post') {
    return actionTaken === 'hide_post' ? 'hide_post' : 'hide_post';
  }

  return actionTaken === 'delete_comment' ? 'delete_comment' : 'delete_comment';
}

function parseJsonBlock(value: string) {
  const fencedMatch = value.match(/```json\s*([\s\S]*?)```/i);
  const raw = fencedMatch?.[1] || value;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI 返回中未找到 JSON');
  }

  return JSON.parse(raw.slice(start, end + 1));
}

function runHeuristicReview(input: ReviewInput): ReviewOutput {
  const analysis = analyzeCommunityContent(
    input.targetTitle ?? undefined,
    input.targetContent,
    input.reportDescription ?? undefined
  );
  if (analysis.blocked) {
    return {
      status: 'reviewed',
      actionTaken: input.targetType === 'post' ? 'hide_post' : 'delete_comment',
      decisionReason: analysis.message || '命中社区自动审核规则',
      handledByAI: false,
    };
  }

  return {
    status: 'pending',
    actionTaken: 'none',
    decisionReason: 'AI 服务不可用，已保留为待人工复核',
    handledByAI: false,
  };
}

export async function reviewCommunityReport(input: ReviewInput): Promise<ReviewOutput> {
  const heuristic = runHeuristicReview(input);
  if (heuristic.status === 'reviewed') {
    return heuristic;
  }

  const prompt = [
    '你是中文母婴社区的内容举报审核助手。',
    '你的任务是根据举报原因、用户补充说明和被举报内容，判断是否需要自动处理。',
    '要求保守，不确定时返回 pending。',
    '如果确认违规：帖子用 hide_post，评论用 delete_comment。',
    '如果举报不成立：返回 rejected，actionTaken 为 none。',
    '只返回 JSON，不要输出额外说明。',
    '',
    JSON.stringify({
      allowedStatus: ['pending', 'reviewed', 'rejected'],
      allowedActionTaken: ['none', 'hide_post', 'delete_comment'],
      targetType: input.targetType,
      reportedReason: input.reason,
      reportDescription: input.reportDescription || '',
      targetTitle: input.targetTitle || '',
      targetContent: input.targetContent,
      outputExample: {
        status: 'reviewed',
        actionTaken: input.targetType === 'post' ? 'hide_post' : 'delete_comment',
        decisionReason: '内容包含明显引流信息',
      },
    }),
  ].join('\n');

  try {
    const result = await callAIGateway([
      { role: 'system', content: '你必须严格输出 JSON。' },
      { role: 'user', content: prompt },
    ], {
      temperature: 0.1,
      maxTokens: 300,
    });

    const parsed = parseJsonBlock(result) as {
      status?: CommunityReportDecision;
      actionTaken?: string;
      decisionReason?: string;
    };

    const status: CommunityReportDecision = parsed.status && ['pending', 'reviewed', 'rejected'].includes(parsed.status)
      ? parsed.status
      : 'pending';
    const actionTaken = normalizeAction(input.targetType, status, parsed.actionTaken || 'none');
    const decisionReason = (parsed.decisionReason || '').trim() || 'AI 已完成自动审核';

    return {
      status,
      actionTaken,
      decisionReason: decisionReason.slice(0, 500),
      handledByAI: true,
    };
  } catch (error) {
    console.error('[Community Report Review] AI review failed:', error);
    return heuristic;
  }
}

export async function applyCommunityReportAction(
  reportId: bigint,
  action: CommunityReportAction
) {
  const report = await prisma.communityReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      postId: true,
      commentId: true,
      targetType: true,
    },
  });

  if (!report) {
    throw new Error('举报记录不存在');
  }

  if (action === 'hide_post') {
    if (!report.postId) {
      throw new Error('举报目标不是帖子');
    }

    await prisma.communityPost.update({
      where: { id: report.postId },
      data: { status: 'hidden' },
    });
    return;
  }

  if (action === 'delete_comment') {
    if (!report.commentId) {
      throw new Error('举报目标不是评论');
    }

    const ids: bigint[] = [report.commentId];
    let frontier: bigint[] = [report.commentId];

    while (frontier.length > 0) {
      const children = await prisma.communityComment.findMany({
        where: { parentId: { in: frontier }, deletedAt: null },
        select: { id: true },
      });

      frontier = children.map((item) => item.id);
      ids.push(...frontier);
    }

    const deletedAt = new Date();
    const [deletedComments, comment] = await Promise.all([
      prisma.communityComment.updateMany({
        where: { id: { in: ids }, deletedAt: null },
        data: { deletedAt },
      }),
      prisma.communityComment.findUnique({
        where: { id: report.commentId },
        select: { postId: true },
      }),
    ]);

    if (comment?.postId && deletedComments.count > 0) {
      const post = await prisma.communityPost.findUnique({
        where: { id: comment.postId },
        select: { commentCount: true },
      });

      await prisma.communityPost.update({
        where: { id: comment.postId },
        data: {
          commentCount: Math.max(0, (post?.commentCount ?? 0) - deletedComments.count),
        },
      });
    }
  }
}
