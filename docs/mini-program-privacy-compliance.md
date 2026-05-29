# 微信小程序隐私合规处理说明

适用小程序：贝护妈妈（`wx77c66576e02a48dc`）

## 本次代码侧处理

- `mini-program/src/manifest.json` 的 `mp-weixin.requiredPrivateInfos` 已声明 `chooseImage`。
- `mini-program/src/manifest.json` 已开启 `__usePrivacyCheck__`，便于开发者工具和真机环境按微信隐私规则触发授权检查。
- `scope.camera` 已补充用途说明：用于拍摄并上传孕育记录照片。

当前代码扫描到的隐私相关数据采集点：

| 场景 | 代码位置 | 接口/采集点 | 后台指引需声明 |
| --- | --- | --- | --- |
| 上传孕育记录照片 | `mini-program/src/pages/calendar/index.vue` | `uni.chooseImage` | 用户选择或拍摄的照片信息 |
| 微信快捷登录 | `mini-program/src/pages/login/index.vue` | `uni.login` | 微信用户标识，用于账号登录与保存进度 |

## 微信公众平台需要补充

进入 `mp.weixin.qq.com -> 设置 -> 服务内容声明 -> 用户隐私保护指引`，修改或新增以下收集使用规则。也可以在代码提审时按同样内容补齐。

建议声明内容：

1. 为实现账号登录、识别用户身份、保存孕周进度，收集微信用户标识（如 OpenID）。
2. 为生成孕周日历、孕育资料推荐和阶段提醒，收集用户主动填写的孕育阶段、孕周、预产期、宝宝生日等孕育档案信息。
3. 为保存孕育记录、待办和完成进度，收集用户主动填写的记录内容、待办内容、完成状态和时间线信息。
4. 为支持上传孕育记录照片，收集用户主动选择或拍摄的照片信息；对应微信隐私接口为 `chooseImage`。
5. 为保障账号与服务安全，收集必要的登录时间、请求日志和异常日志。

不要勾选当前代码未使用的隐私能力，例如手机号、通讯地址、精确地理位置、通讯录、微信运动等。

## 存储与第三方服务说明

- 小程序接口默认访问 `https://beihu.me/api/v1`。
- 用户上传的孕育记录照片默认保存在服务端 `/uploads`；生产环境如果启用 `UPLOAD_STORAGE_DRIVER=cos` 或 `COS_STORAGE_ENABLED=true`，照片会上传到腾讯云对象存储 COS，并通过 `COS_PUBLIC_BASE_URL` 对外访问。
- 隐私指引中如需要填写第三方处理方，生产启用 COS 时应注明腾讯云对象存储用于图片存储与访问。

## 提审前验证

```bash
npm --prefix mini-program run build:mp-weixin
```

构建后检查 `mini-program/dist/build/mp-weixin/app.json`：

```json
{
  "__usePrivacyCheck__": true,
  "requiredPrivateInfos": ["chooseImage"]
}
```

微信后台隐私指引保存后通常需要数分钟生效。若真机仍提示 `api scope is not declared in the privacy agreement`，先等待 5 分钟，再清理开发者工具授权数据或从微信“最近使用的小程序”中删除后重试。

## 处理截止时间

微信站内信要求在 2026-06-28 前完善，否则会回收小程序隐私接口调用权限。本仓库代码侧已补齐声明，但最终解除风险仍取决于微信公众平台后台《用户隐私保护指引》保存成功并重新提审。
