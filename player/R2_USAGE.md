# R2 使用说明（增量上传）

本文档说明如何把 `lizhi-lyrics/albums` 增量同步到 Cloudflare R2，并让应用从 R2 读取专辑资源。

## 1. 前置条件

- 已创建 R2 bucket：`lizhi-2026`
- 已开启 Public Development URL（当前可用）：`https://pub-abc2b17133e64f9dbae981f9123132dc.r2.dev`
- 已创建 R2 S3 凭证（`Access Key ID` / `Secret Access Key`）
- 本机已安装 AWS CLI v2：`aws --version`

## 2. 应用运行时变量（部署平台）

```env
ASSET_SOURCE=cloud
ASSET_BASE_URL=https://pub-abc2b17133e64f9dbae981f9123132dc.r2.dev
ASSET_PREFIX=albums
```

说明：
- `ASSET_SOURCE=cloud`：启用云资源模式
- `ASSET_BASE_URL`：资源公网访问域名（当前使用 r2.dev）
- `ASSET_PREFIX`：桶内目录前缀

## 3. 上传前先生成索引

在 `player` 目录执行：

```bash
npm run build:album-index
```

会生成：

```text
src/data/albums-index.json
```

## 4. 增量上传命令（默认不删除远端）

在 `player` 目录执行：

```bash
S3_BUCKET=lizhi-2026 \
S3_ENDPOINT_URL=https://2d84be4d80ee93ea71b86d7b9f48be88.r2.cloudflarestorage.com \
S3_REGION=auto \
AWS_ACCESS_KEY_ID=你的AccessKeyID \
AWS_SECRET_ACCESS_KEY=你的SecretAccessKey \
npm run upload:albums:s3
```

脚本行为：
- 使用 `aws s3 sync`，只同步新增或变化文件
- 默认 `SYNC_DELETE=false`，不会删除桶里已有对象
- 自动按文件类型设置 `content-type` 和 `cache-control`

## 5. Dry-run 预演（推荐先跑）

```bash
DRY_RUN=true \
S3_BUCKET=lizhi-2026 \
S3_ENDPOINT_URL=https://2d84be4d80ee93ea71b86d7b9f48be88.r2.cloudflarestorage.com \
S3_REGION=auto \
AWS_ACCESS_KEY_ID=你的AccessKeyID \
AWS_SECRET_ACCESS_KEY=你的SecretAccessKey \
npm run upload:albums:s3
```

## 6. 仅在需要时才开启删除远端

如果后续要“以本地为准”清理远端多余对象，显式加：

```bash
SYNC_DELETE=true \
S3_BUCKET=lizhi-2026 \
S3_ENDPOINT_URL=https://2d84be4d80ee93ea71b86d7b9f48be88.r2.cloudflarestorage.com \
S3_REGION=auto \
AWS_ACCESS_KEY_ID=你的AccessKeyID \
AWS_SECRET_ACCESS_KEY=你的SecretAccessKey \
npm run upload:albums:s3
```

## 7. 专辑有增量更新时的标准流程

1. 更新本地专辑文件到 `../lizhi-lyrics/albums`
2. 运行 `npm run build:album-index`
3. 运行增量上传命令（默认不删远端）
4. 重新部署应用（让新的 `albums-index.json` 生效）

## 8. 快速验证

上传后可先检查对象列表：

```bash
AWS_ACCESS_KEY_ID=你的AccessKeyID \
AWS_SECRET_ACCESS_KEY=你的SecretAccessKey \
aws --endpoint-url https://2d84be4d80ee93ea71b86d7b9f48be88.r2.cloudflarestorage.com \
  --region auto s3 ls s3://lizhi-2026/albums --recursive | head
```

应用侧验证：
- `GET /api/songs` 返回专辑数据
- `GET /api/covers?...` 返回 307 到 `r2.dev`
- `GET /api/audio?...` 返回 307 到 `r2.dev`
- 页面能正常加载封面、歌词、音频播放

## 9. 安全建议

- 不要在聊天、日志、仓库中粘贴密钥
- 如果密钥泄露，立即在 Cloudflare 撤销并重建
- 建议把 Token 权限收敛到指定 bucket
