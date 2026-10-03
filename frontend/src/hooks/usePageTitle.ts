import { useEffect } from 'react'

const BASE_TITLE = '贝护妈妈'
const DEFAULT_TITLE = `${BASE_TITLE} · 权威母婴知识库`

/**
 * 设置文档标题；卸载或变化时还原/更新。
 * 服务真实用户的标签页与浏览器历史（worker 端 meta 注入服务爬虫与分享卡，二者互补）。
 * 传 undefined 保持默认标题（如详情加载中），避免占位标题闪烁。
 */
export function usePageTitle(title: string | undefined): void {
  useEffect(() => {
    if (title === undefined) return
    document.title = title.includes(BASE_TITLE) ? title : `${title} | ${BASE_TITLE}`
    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [title])
}
