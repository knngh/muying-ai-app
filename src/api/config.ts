/**
 * API 配置
 * 
 * 开发环境：使用本地服务
 * 生产环境：使用服务器域名
 */

// 开发环境配置
const development = {
  baseURL: 'http://localhost:3000/api',
  // H5 前端部署地址（用于 web-view）
  h5URL: 'http://localhost:5173'
};

// 生产环境配置
const production = {
  // 替换为你的服务器域名
  baseURL: 'https://h5.xxx.com/api',
  // 替换为你的 H5 部署地址
  h5URL: 'https://h5.xxx.com'
};

// 根据环境自动选择
const env = import.meta.env.MODE === 'production' ? production : development;

export default env;
