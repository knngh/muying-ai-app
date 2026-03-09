/**
 * 部署配置
 * 用于自动化部署到宝塔服务器
 */

module.exports = {
  // 服务器配置
  server: {
    host: '118.25.97.135',
    port: 22,
    username: 'root',
    password: 'Zgh112134'
  },

  // 部署路径配置
  paths: {
    // 本地构建输出目录
    localDist: 'dist/build/h5',
    
    // 远程服务器网站根目录
    remoteRoot: '/www/wwwroot/muying-ai',
    
    // 备份目录
    backupDir: '/www/backup/site'
  },

  // 构建命令
  buildCommand: 'npm run build:h5',

  // 部署后是否重启 Nginx
  restartNginx: true
};
