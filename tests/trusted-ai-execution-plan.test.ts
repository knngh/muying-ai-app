import { compactEquivalentExecutionPlan } from '../src/services/trusted-ai.service';
import type { AITaskModelBinding } from '../src/services/ai-gateway.service';
import type { ExecutionStep } from '../src/services/ai-route-planner.service';

function binding(
  role: AITaskModelBinding['role'],
  provider: string,
  model: string,
  configured = true,
): AITaskModelBinding {
  return {
    role,
    provider,
    model,
    configured,
  };
}

describe('trusted AI execution plan compaction', () => {
  it('keeps only the last task step when task roles point to the same provider and model', () => {
    const plan: ExecutionStep[] = ['kimi_reason', 'minimax_render'];
    const result = compactEquivalentExecutionPlan(plan, [
      binding('kimi_reason', 'deepseek', 'deepseek-v4-flash'),
      binding('minimax_render', 'deepseek', 'deepseek-v4-flash'),
    ]);

    expect(result).toEqual(['minimax_render']);
  });

  it('preserves distinct provider/model task steps', () => {
    const plan: ExecutionStep[] = ['kimi_reason', 'minimax_render'];
    const result = compactEquivalentExecutionPlan(plan, [
      binding('kimi_reason', 'openrouter', 'kimi-k2.5'),
      binding('minimax_render', 'minimax', 'MiniMax-M2.7'),
    ]);

    expect(result).toEqual(plan);
  });

  it('does not compact unconfigured task bindings', () => {
    const plan: ExecutionStep[] = ['kimi_reason', 'minimax_render'];
    const result = compactEquivalentExecutionPlan(plan, [
      binding('kimi_reason', '', '', false),
      binding('minimax_render', '', '', false),
    ]);

    expect(result).toEqual(plan);
  });

  it('keeps system steps because they are not model calls', () => {
    const plan: ExecutionStep[] = ['system', 'glm_classify', 'minimax_render'];
    const result = compactEquivalentExecutionPlan(plan, [
      binding('glm_classify', 'deepseek', 'deepseek-v4-flash'),
      binding('minimax_render', 'deepseek', 'deepseek-v4-flash'),
    ]);

    expect(result).toEqual(['system', 'minimax_render']);
  });
});
