# 连接自己的 Google Drive

云盘只在「收藏实验室」特别版中提供，稳定版没有云盘入口。

本版包含真实 Drive API 上传代码，但安装包没有任何人的 Google OAuth 客户端 ID 或登录凭证。完成下面的一次性配置与授权后才能上传；未配置时仍可本机收图。

## lab.12 连接修复

若旧版在授权后仍显示「云盘网络中断」，可能是已修复的浏览器原生 fetch 调用问题。更新后重新加载扩展再连接，无需因此重新创建客户端。保留当前安装目录和 OAuth 配置；用户已确认自己的 Google Drive 授权和上传成功。

## 一次性配置

1. 保留原特别版文件夹和已安装的扩展，不要卸载或改路径。点击「设置 → Google Drive → 连接与设置」，会打开本地库并展开「首次连接配置」，点击「复制扩展 ID」。
2. 在 [Google Cloud 控制台](https://console.cloud.google.com/) 创建或选择自己的项目，启用 Google Drive API。
3. 在 Google Auth Platform 配置应用信息、受众和 OAuth 权限，申请 `https://www.googleapis.com/auth/drive.file`。测试状态时把自己的 Google 账号加入测试用户。
4. 创建 Chrome Extension 类型的 OAuth 客户端，把第 1 步的扩展 ID 填在 Item ID 中。复制创建的客户端 ID（结尾为 `.apps.googleusercontent.com`）。
5. 双击本安装包根目录的「配置 Google Drive.cmd」，粘贴客户端 ID。工具只修改同目录 manifest.json 的 oauth2 配置，备份为 manifest.before-google-drive.json，不修改扩展 key 或图库。
6. 在 chrome://extensions 重新加载当前特别版，刷新 X 并重新打开本地库，点击「连接并同步收藏」，在 Google 页面登录并授权。

**连接即开始上传本地已有收藏，以及之后新收下的照片。** 如仅想在本机收图，可以保持未连接。配置客户端 ID 不等于完成授权，不要粘贴密码、客户端密钥或访问令牌。

没有找到扩展对应的客户端、Chrome 未登录或测试账号不在许可列表时，Google 可能拒绝授权。检查上述配置后重试，不要把其他平台的客户端 ID 直接替换进来。

## 第一次怎样确认成功

先在本机收下一条四图推文，连接后打开 Drive 的「拾图 · 原图库」，检查四张独立原文件与一份出处 JSON；本机整组显示「已入云」。请注意连接后会同步已有本地收藏，不只上传这一组。真实授权出现错误时，保留完整错误提示以定位客户端类型、扩展 ID、测试账号或 Chrome 登录问题。

## 同步行为

- Drive 创建私人文件夹「拾图 · 原图库」，不创建公开共享权限。普通图集和切片都保存每张独立原文件，JPEG 保持 JPEG；本版不额外上传合成图或视频。
- 原文件以 SHA-256 命名和去重；每组有「推文-ID-版本.json」，保留作者、出处、原图顺序、标签与云端文件 ID。标签变化时会生成新版清单，旧清单保留。
- 分块上传及进度保存在本机。上传中断先查询服务器收到的字节再继续，固定文件编号防止回执丢失后重复新建。原图和清单的大小、服务端 SHA-256 均确认后才显示「已入云」。
- Google 限流和暂时断网会退避重试；连续五次失败保留手动重试。授权失效、空间不足或目录问题会暂停，排除问题后重连或重试。
- 同步当前只做上传备份；没有从 Drive 恢复整库、双向同步、自动分类、独立手机图库。手机可先用 Drive App 查看原文件。
- 原图已在云端但本地状态尚未写入时，重启后会查询原文件确认，不凭本地「上传过」标记判定成功。

## 断开与账号

点击「断开连接」会停止上传并中止进行中的请求，云端文件保留。一个正在结束的请求可能已经到达 Google；不会为了断开而删除它。

访问令牌只由 Chrome identity 缓存及扩展后台使用，不写入图库、导出或 X 页面。同步任务与云端文件编号按 Google 账号隔离。切换账号须先断开再连接；已在另一账号保存的文件不会冒充新账号的同步结果。若要撤销 Google 端授权，请到 Google 账号的第三方应用权限页操作。

升级覆盖文件后，如 manifest.json 被替换，需再次运行配置工具填写同一个客户端 ID。保留原路径与扩展 ID，原图、任务和清单仍在同一扩展的本地库。

依据：[Drive 文件权限](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)、[可恢复上传](https://developers.google.com/workspace/drive/api/guides/manage-uploads)、[Chrome OAuth](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth)。真实账号上传必须在自己的环境试用验收。
