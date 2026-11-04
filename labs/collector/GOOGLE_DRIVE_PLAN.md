# Google Drive 接入方案

2026-11-05。lab.8 已实现授权、上传、续传、去重与状态界面，已通过模拟 API 和隔离 Chromium 验证，真实 Google 账号尚待验收。配置见 extension/Google Drive 使用说明.md。

## 用户体验

用户主动点「连接 Google Drive」，在 Google 页面登录并授权。首次配置要创建 Google Cloud 项目、启用 Drive API、配置 OAuth 同意界面和 Chrome Extension 客户端，绑定现有扩展 ID。配置不通过更改扩展 ID 完成，避免失去原本的扩展本地库。不能把在 Codex 中连接 Drive 当作插件已经获得授权。

授权后，拾图创建私人目录。默认保留原格式与整组顺序；普通多图是独立文件，切片原片同样独立保留，合成图若保存则作为额外文件。先支持电脑上传、Drive 手机端查看；专用手机图库、自动标签与偏好学习另行迭代。

## 权限与账号

优先申请 drive.file，仅管理应用创建或用户明确授予应用的文件。目录是产品约定，不应宣称 OAuth 权限被限定为单个文件夹。通过 Chrome identity 获取短期凭据；交互授权只能由用户主动触发。应用客户端 ID 不等于秘密密钥，访问令牌不放仓库、不发给 X 页面。需要账号绑定与切换检查，避免把另一账号的文件标成已同步。

## 文件与索引

本次实际目录：拾图 · 原图库 / SHA256.原扩展名，另有按推文编号保存的来源清单。原文件按字节哈希去重；清单保存作者、来源、图集顺序、标签与每个 Drive 文件 ID。暂不按标签搬动原文件，一图多标签由清单表达。

为避免上传成功但回执丢失造成重复文件，使用预生成文件 ID 并在上传前持久保存；恢复时先查询目标文件。对照片原文件和清单分别核对完成状态，整组文件及出处都确认后才显示「已入云」。API 允许查询自定义文件属性，可以记录哈希和数据格式版本。

## 队列分层

本地保存与云同步有独立状态。当前本地 pending / saving / failed / saved 不代表上传状态。后续新增待授权 / 待上传 / 上传中 / 需重试 / 已入云，并记录账号、目标目录、预生成文件 ID、上传会话和服务端确认结果。

上传优先使用可恢复上传；浏览器关闭、网络断开、401 失效、空间不足、429 限流应分别处理。保存继续工作，授权失效后停止上传并等待用户重连；取消 X 点赞不会自动删除已经保存的原图。

## 验收

同一条四图推文在电脑收下后，Drive 出现完整四图与清单，手机可查看。重复同步不重复文件。上传任一片失败不能显示整组已入云。浏览器重启后能恢复；切换账号不会误用上一个账号的完成状态。断开授权后不上传，扩展仍可本地收图和导出。

参考：[Google Drive 权限](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)、[上传与预生成文件 ID](https://developers.google.com/workspace/drive/api/guides/manage-uploads)、[Chrome 扩展 OAuth](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth)、[扩展 OAuth manifest](https://developer.chrome.com/docs/extensions/reference/manifest/oauth2)。
