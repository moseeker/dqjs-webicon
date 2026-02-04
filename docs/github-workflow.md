# GitHub Workflow 配置

## Secrets

在 **Settings → Secrets and variables → Actions** 添加：

| Name | 说明 |
|------|------|
| `WEBHOOK_NOTIFY_API_KEY` | 企业微信 webhook key，用于构建通知 |
| `NPM_AUTH_URL` | NPM 认证配置，格式如 `//registry.example.com/:_authToken=TOKEN` |
| `NPM_REGISTRY_URL` | 私有 NPM registry 地址，如 `https://registry.example.com/` |

## Pages

在 **Settings → Pages** 配置：

- **Source**: `GitHub Actions`

## Commit 规范

图标变更使用前缀 `[icon]:` 以触发通知：

```bash
git commit -m "[icon]: 添加 xxx 图标"
```

## 预览地址

```
https://<org>.github.io/<repo>/
```
