<template><image class="tool-symbol" :src="`/static/tools/${id}.png`" mode="aspectFit" aria-hidden="true" /></template>
<script setup lang="ts">
import type { ToolId } from '@/data/tool-catalog'
defineProps<{ id: ToolId }>()
</script>
<style scoped>
.tool-symbol { display: block; width: 44rpx; height: 44rpx; }
</style>
