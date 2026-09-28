// beihu-web Worker：权威知识库网页版（Cloudflare Workers 免费方案）
//
// 请求分流：
// - /api/* 服务端反向代理到 https://beihu.me（服务端转发不受浏览器 CORS 限制，
//   beihu.me 后端/nginx 零改动 —— 2026-09-26 约束：不动 beihu.me 域名与配置）
// - 其余请求交给 dist 静态资源；未命中路径由 assets 的
//   not_found_handling: single-page-application 回退到 index.html（SPA 深链 /knowledge 可直达）

interface Env {
  ASSETS: { fetch(input: RequestInfo, init?: RequestInit): Promise<Response> }
}

const UPSTREAM_ORIGIN = 'https://beihu.me'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      const upstream = new Request(UPSTREAM_ORIGIN + url.pathname + url.search, request)
      // 去掉 Origin：上游 CORS 中间件按来源决定是否附加 ACAO 头，
      // 本站同域调用浏览器不校验 CORS，无需透传
      upstream.headers.delete('origin')
      const upstreamResponse = await fetch(upstream)
      const response = new Response(upstreamResponse.body, upstreamResponse)
      response.headers.set('Cache-Control', 'no-store')
      return response
    }

    const assetResponse = await env.ASSETS.fetch(request)
    const response = new Response(assetResponse.body, assetResponse)
    response.headers.set('Cache-Control', 'no-cache')
    return response
  },
}
