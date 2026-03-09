<template>
  <web-view :src="url"></web-view>
</template>

<script>
export default {
  data() {
    return {
      // 替换为你的 H5 部署地址（从宝塔部署后获取）
      // 例如：https://h5.xxx.com 或 http://你的服务器IP
      url: 'https://h5.xxx.com'
    }
  },
  onLoad(options) {
    // 支持从外部传入 URL 参数
    // 使用方式：uni.navigateTo({ url: '/pages/webview/webview?src=' + encodeURIComponent('https://xxx.com') })
    if (options.src) {
      this.url = decodeURIComponent(options.src)
    }
    
    // 设置页面标题
    uni.setNavigationBarTitle({
      title: '母婴AI日历'
    })
  }
}
</script>
