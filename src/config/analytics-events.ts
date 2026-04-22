export const ANALYTICS_EVENT_NAMES = [
  'mini_program_app_download_click',
  'app_membership_exposure',
  'app_membership_context_exposure',
  'app_membership_context_click',
  'app_order_created',
  'app_payment_success',
  'app_weekly_report_open',
  'app_weekly_report_add_calendar_click',
  'app_weekly_report_ask_ai_click',
  'app_growth_archive_share',
  'app_growth_archive_context_exposure',
  'app_growth_archive_context_click',
  'app_home_v1_exposure',
  'app_home_return_plan_exposure',
  'app_home_return_plan_click',
  'app_home_membership_nudge_exposure',
  'app_home_membership_nudge_click',
  'app_home_growth_archive_click',
  'app_home_primary_task_click',
  'app_home_checkin_click',
  'app_home_weekly_report_click',
  'app_home_momentum_click',
  'app_home_suggested_question_click',
  'app_home_post_checkin_next_click',
  'app_chat_prefill_entry',
  'app_chat_message_send',
  'app_chat_response_receive',
  'app_chat_add_calendar_click',
  'app_chat_open_knowledge_click',
  'app_chat_open_hit_article_click',
  'app_chat_open_archive_click',
  'app_knowledge_recent_ai_hit_click',
  'app_knowledge_recent_ai_topic_click',
  'app_knowledge_recent_ai_source_click',
  'app_knowledge_recent_ai_ask_click',
  'app_knowledge_detail_ai_hit_open',
  'app_knowledge_detail_ask_ai_click',
] as const;

export const ANALYTICS_CLIENT_SOURCES = ['app', 'mini_program'] as const;

export const ANALYTICS_FUNNEL_STEPS = [
  { eventName: 'mini_program_app_download_click', label: '小程序下载点击' },
  { eventName: 'app_membership_exposure', label: '会员页曝光' },
  { eventName: 'app_order_created', label: '下单创建' },
  { eventName: 'app_payment_success', label: '支付成功' },
  { eventName: 'app_weekly_report_open', label: '周报打开' },
  { eventName: 'app_growth_archive_share', label: '成长档案分享' },
] as const;

export type AnalyticsEventName = typeof ANALYTICS_EVENT_NAMES[number];
export type AnalyticsClientSource = typeof ANALYTICS_CLIENT_SOURCES[number];
