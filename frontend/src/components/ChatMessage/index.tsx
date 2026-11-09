import type { AIMessage } from "@/api/ai";
import styles from "./ChatMessage.module.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessageProps {
  message: AIMessage;
}

const reliabilityLabelMap = {
  authoritative: "权威来源优先",
  mixed: "结合权威资料与知识库",
  dataset_only: "来自知识库",
  none: "暂无可靠来源",
} as const;

function getRiskLabel(riskLevel: AIMessage["riskLevel"]) {
  if (riskLevel === "red") return "请及时就医";
  if (riskLevel === "yellow") return "需要留意";
  return "";
}

function getRiskClassName(riskLevel: AIMessage["riskLevel"]) {
  if (riskLevel === "red") return styles.tagRiskRed;
  if (riskLevel === "yellow") return styles.tagRiskYellow;
  return "";
}

function sourceHref(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url, window.location.origin);
    return /^https?:$/.test(parsed.protocol) ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

// Omit only text already present verbatim, ignoring Markdown and whitespace.
function comparableText(text: string) {
  return text.replace(/[*_`#>\s]/g, "");
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const contentText = comparableText(message.content);
  const additional = (items: string[] = []) =>
    items.filter(
      (item) => item.trim() && !contentText.includes(comparableText(item)),
    );
  const conclusion = additional([
    message.structuredAnswer?.conclusion || "",
  ])[0];
  const reasons = additional(message.structuredAnswer?.reasons);
  const actions = additional(message.structuredAnswer?.actions);
  const whenToSeekCare = additional(message.structuredAnswer?.whenToSeekCare);
  const uncertainty =
    message.uncertainty?.message || message.structuredAnswer?.uncertaintyNote;
  const hasSupplement = conclusion || reasons.length > 0 || actions.length > 0;
  const hasTrustInfo =
    message.sourceReliability ||
    getRiskLabel(message.riskLevel) ||
    hasSupplement ||
    whenToSeekCare.length > 0 ||
    uncertainty;

  return (
    <div
      className={`${styles.messageWrapper} ${isUser ? styles.userMessage : styles.assistantMessage}`}
    >
      <div className={styles.avatar} aria-hidden="true">
        {isUser ? "我" : "AI"}
      </div>
      <article
        className={`${styles.messageCard} ${message.isEmergency ? styles.emergencyCard : ""}`}
        aria-label={isUser ? "我的问题" : "AI 回答"}
      >
        {message.isEmergency ? (
          <div className={styles.emergencyAlert}>
            <strong>紧急情况警告</strong>
            <span>如出现明显不适、持续加重或危险信号，请立即就医。</span>
          </div>
        ) : null}

        {isUser ? (
          <div className={styles.userText}>{message.content}</div>
        ) : (
          <div className={styles.markdown}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h2>{children}</h2>,
                table: ({ children }) => (
                  <div
                    className={styles.tableScroll}
                    tabIndex={0}
                    role="region"
                    aria-label="回答中的表格，可横向滚动"
                  >
                    <table>{children}</table>
                  </div>
                ),
                a: ({ href, children }) =>
                  sourceHref(href) ? (
                    <a
                      href={sourceHref(href)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {children}
                    </a>
                  ) : (
                    <span>{children}</span>
                  ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {!isUser && hasTrustInfo ? (
          <div className={styles.trustPanel}>
            <div className={styles.tagGroup}>
              {message.sourceReliability ? (
                <span
                  className={`${styles.tag} ${message.sourceReliability === "authoritative" ? styles.tagAuthority : ""}`}
                >
                  {reliabilityLabelMap[message.sourceReliability]}
                </span>
              ) : null}
              {getRiskLabel(message.riskLevel) ? (
                <span
                  className={`${styles.tag} ${getRiskClassName(message.riskLevel)}`}
                >
                  {getRiskLabel(message.riskLevel)}
                </span>
              ) : null}
            </div>
            {hasSupplement ? (
              <section className={styles.trustSummary} aria-label="补充建议">
                <strong>补充建议</strong>
                {conclusion ? <p>{conclusion}</p> : null}
                {reasons.length ? (
                  <ul className={styles.trustList}>
                    {reasons.map((reason, index) => (
                      <li key={index}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
                {actions.length ? (
                  <ol className={styles.trustList}>
                    {actions.map((action, index) => (
                      <li key={index}>{action}</li>
                    ))}
                  </ol>
                ) : null}
              </section>
            ) : null}
            {whenToSeekCare.length ? (
              <section className={styles.careAlert} aria-label="何时就医">
                <strong>何时就医</strong>
                <ul className={styles.trustList}>
                  {whenToSeekCare.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {uncertainty ? (
              <div className={styles.uncertaintyAlert}>
                <strong>需要进一步确认</strong>
                <span>{uncertainty}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {message.sources?.length ? (
          <section className={styles.sources} aria-label="参考来源">
            <strong className={styles.sourcesTitle}>
              参考来源 · {message.sources.length}
            </strong>
            <ol className={styles.sourceList}>
              {message.sources.map((source, index) => {
                const href = sourceHref(source.url);
                return (
                  <li key={`${source.title}-${index}`}>
                    {href ? (
                      <a
                        className={styles.sourceLink}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {source.title}
                        <span aria-hidden="true"> ↗</span>
                      </a>
                    ) : (
                      <span>{source.title}</span>
                    )}
                    {source.sourceOrg || source.source ? (
                      <small>{source.sourceOrg || source.source}</small>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}
        <time className={styles.timestamp} dateTime={message.createdAt}>
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </article>
    </div>
  );
}
