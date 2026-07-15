# HKBA 数据、API 与发布规范

日期：2026-07-15
关联主设计：[HKBA 轻量页面构建后台总设计](./2026-07-15-hkba-lightweight-page-builder-design.md)

## 1. 设计原则

- 页面身份与页面版本分离。
- 草稿和正式版本并存，正式站点只读取已发布版本。
- 页面结构使用显式 `PageBlock`，组件内容使用受 schema 验证的 JSON 配置。
- 新闻是独立内容实体；页面组件保存查询条件，不复制新闻正文。
- 媒体使用稳定 ID 引用，不把临时上传 URL 当作内容数据。
- 所有写接口同时执行权限、输入 schema 和修订号检查。

## 2. 核心模型

### 2.1 Page

- `id`：稳定 ID；现有页面迁移时保留 SQLite 整数 ID，新建版本及组件表可使用文本 UUID。
- `parentId`：父栏目或父页面；顶级为 null。
- `nodeType`：`section` 或 `page`。
- `slug`：同一父节点下唯一。
- `path`：计算并持久化的标准路径，全站唯一。
- `titleZh`、`titleEn`：树和导航名称。
- `navigationStatus`：`visible`、`hidden`、`external`。
- `externalUrl`：外部跳转时必填。
- `sortOrder`：同级排序。
- `publishedVersionId`：当前正式版本。
- `draftVersionId`：当前工作草稿。
- `deletedAt`：回收站软删除时间。

约束：节点不能成为自己的后代；最大深度为 3；外部跳转栏目不能同时承载页面组件。

### 2.2 PageVersion

- `id`、`pageId`、`revision`。
- `status`：`draft`、`published`、`superseded`。
- `seo`：受 schema 验证的 SEO 配置。
- `createdBy`、`createdAt`、`publishedBy`、`publishedAt`。
- `sourceVersionId`：复制或回退来源。

页面中英文组件默认属于同一版本，保证一次发布切换两种语言。缺失翻译作为发布检查项，而不是创建两条互相漂移的页面版本。

### 2.3 PageBlock

- `id`、`pageVersionId`。
- `componentType`、`componentVersion`。
- `sortOrder`、`parentBlockId`。
- `isVisible`、`anchorId`。
- `contentZh`、`contentEn`、`settings`。
- `createdAt`、`updatedAt`。

`parentBlockId` 只用于允许的布局组件，嵌套最多两层。

### 2.4 News

- `id`、`slug`。
- `titleZh`、`titleEn`、`summaryZh`、`summaryEn`。
- `coverMediaId`、`authorId`。
- `publishedAt`、`displayYear`。
- `status`：`draft`、`scheduled`、`published`、`withdrawn`、`trash`。
- `currentDraftRevision`、`publishedRevision`。
- `seo`、`createdAt`、`updatedAt`。

新闻栏目和标签使用关联表，不保存自由文本数组。

### 2.5 NewsBlock

- `id`、`newsId`、`revision`。
- `blockType`、`blockVersion`、`sortOrder`。
- `contentZh`、`contentEn`、`settings`。

正文修订与新闻元数据使用同一个新闻修订号发布。

### 2.6 MediaAsset

- `id`、`storageKey`、`originalFilename`。
- `mimeType`、`sizeBytes`、`width`、`height`。
- `checksum`、`status`。
- `altZh`、`altEn`、`captionZh`、`captionEn`。
- `variants`：响应式尺寸及格式。
- `uploadedBy`、`createdAt`、`deletedAt`。

`MediaReference` 保存媒体被页面版本、页面组件、新闻修订或新闻组件引用的关系。

### 2.7 ComponentDefinition

组件定义以代码注册表为主，数据库只保存可搜索的同步元数据，不允许后台创建任意组件代码。

### 2.8 用户、角色和审计

- `AdminUser`：账户、状态和最后登录时间。
- `Role`、`Permission`、`UserRole`。
- `AuditEvent`：操作者、动作、对象、请求 ID、前后摘要、时间和 IP/会话信息。

## 3. API 约定

本文使用 REST 语义描述接口；如果目标项目使用 Server Actions 或 GraphQL，必须保持相同权限、校验和状态边界。

成功响应：

```json
{
  "success": true,
  "data": {},
  "meta": { "requestId": "..." }
}
```

失败响应：

```json
{
  "success": false,
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "页面已被其他编辑更新",
    "fields": []
  },
  "meta": { "requestId": "..." }
}
```

常用错误代码：`VALIDATION_FAILED`、`UNAUTHENTICATED`、`FORBIDDEN`、`NOT_FOUND`、`REVISION_CONFLICT`、`REFERENCE_EXISTS`、`UPLOAD_REJECTED`、`PUBLISH_CHECK_FAILED`、`PUBLISH_TRANSACTION_FAILED`。

## 4. 栏目与页面接口

- `GET /admin/pages/tree`：返回栏目树、状态、草稿和翻译提醒。
- `POST /admin/pages`：新增栏目或页面。
- `PATCH /admin/pages/:id`：修改标题、导航和 SEO 基础信息。
- `POST /admin/pages/:id/move`：移动父节点或同级顺序；服务端检查循环和深度。
- `POST /admin/pages/:id/duplicate`：复制为新草稿页面。
- `DELETE /admin/pages/:id`：移入回收站；子项处理策略必填。
- `POST /admin/pages/:id/restore`：从回收站恢复。
- `GET /admin/pages/:id/draft`：读取草稿版本和组件。
- `PATCH /admin/pages/:id/draft`：使用 `expectedRevision` 保存变更。

页面草稿写入必须幂等。客户端为一次自动保存生成 `mutationId`，网络重试不会重复插入组件。

## 5. 组件接口

- `GET /admin/components/definitions`：可用组件和 schema。
- `POST /admin/pages/:pageId/blocks`：在草稿版本添加组件。
- `PATCH /admin/pages/:pageId/blocks/:blockId`：修改组件配置。
- `POST /admin/pages/:pageId/blocks/reorder`：批量排序。
- `POST /admin/pages/:pageId/blocks/:blockId/duplicate`：复制组件实例。
- `DELETE /admin/pages/:pageId/blocks/:blockId`：从草稿删除。

服务端根据组件注册表验证 `componentType`、版本、嵌套和配置字段。未知字段默认拒绝，不直接写入数据库。

## 6. 新闻接口

- `GET /admin/news`：按状态、栏目、年份、语言完整度搜索。
- `POST /admin/news`：创建新闻草稿。
- `GET /admin/news/:id`：读取新闻及当前修订。
- `PATCH /admin/news/:id`：保存元数据和正文组件，要求 `expectedRevision`。
- `POST /admin/news/:id/preview`：创建短期预览令牌。
- `POST /admin/news/:id/publish`：检查并发布。
- `POST /admin/news/:id/withdraw`：撤回新闻。
- `POST /admin/news/:id/restore-revision`：从历史修订生成新草稿。

公开新闻查询：

- `GET /api/news?year=&category=&tag=&page=&limit=`。
- `GET /api/news/:slug`。
- 年份列表来自真实已发布内容：`GET /api/news/years`。

所有公开查询只返回 `published` 新闻，并使用 `displayYear ?? year(publishedAt)` 进行年份筛选。

## 7. 媒体接口

推荐使用签名直传：

1. `POST /admin/media/uploads` 请求上传会话并提交文件元数据。
2. 客户端使用短期签名 URL 上传对象存储。
3. `POST /admin/media/uploads/:id/complete` 完成校验和媒体处理。
4. 异步生成响应式变体；未完成时组件显示处理状态。

其他接口：

- `GET /admin/media`：搜索、筛选和未使用素材。
- `PATCH /admin/media/:id`：替代文字、图注和文件名。
- `GET /admin/media/:id/references`：查看引用。
- `DELETE /admin/media/:id`：移入媒体回收站。
- `DELETE /admin/media/:id/permanent`：仅无正式引用且具备权限时永久删除。

允许格式和默认限制：JPEG、PNG、WebP、AVIF、SVG（经过清理）、PDF；图片单文件 15 MB，PDF 30 MB。视频首期使用受支持的外部平台链接；直接视频上传在运维容量确认后开放。

## 8. 自动保存和冲突

- 客户端停止输入 800ms 后触发自动保存；结构拖动完成后立即保存。
- 同一页面的连续变更合并为一次请求。
- 请求携带 `expectedRevision` 和 `mutationId`。
- 修订不一致返回 `REVISION_CONFLICT` 和当前最新修订。
- 界面提供：刷新到最新、复制本地修改为新草稿、重新应用本次字段修改。

首期不尝试自动合并整个页面 JSON，避免产生不可预测结构。

## 9. 发布检查

页面发布前检查：

- 路径唯一、栏目层级有效。
- 所有组件类型和版本受支持。
- 必填字段、链接、媒体和锚点有效。
- 中文、英文符合页面发布规则。
- SEO 标题、描述和分享图片完整。
- 引用的新闻、页面和媒体可公开访问。

新闻发布前检查：

- 标题、摘要、栏目、发布日期和正文完整。
- `displayYear` 为合理四位年份。
- 封面和正文媒体有效。
- 中英文符合发布规则。
- slug 唯一且相关链接有效。

检查失败返回结构化问题数组，包含对象 ID、组件 ID、语言、字段和修复提示。

## 10. 发布事务

页面发布：

1. 锁定页面记录。
2. 再次检查预期草稿修订。
3. 创建不可变发布版本快照。
4. 更新 `publishedVersionId`。
5. 写入发布和审计记录。
6. 提交事务。
7. 提交后刷新页面、导航、站点地图和相关查询缓存。

缓存刷新失败不回滚已成功的数据库发布，但必须记录可重试任务并在后台显示“内容已发布，缓存刷新处理中”。

## 11. 预览与回退

- 预览令牌绑定对象、修订、用户和过期时间，默认 30 分钟。
- 预览响应禁止搜索引擎索引和公共缓存。
- 回退从目标历史版本复制出新草稿，修订号继续递增。
- 管理员检查新草稿后再次发布，审计日志记录来源版本。

## 12. 保留与清理

- 每个页面保留最近 20 个发布版本。
- 草稿自动保存修订保留 30 天，并至少保留最近 20 次。
- 新闻使用相同保留策略。
- 回收站保留 30 天。
- 正式版本引用的媒体不受自动清理影响。
- 清理任务只处理无引用派生文件和过期上传会话，并输出可审计结果。

## 13. 安全

- 会话使用 HttpOnly、Secure、SameSite Cookie。
- 所有写操作验证 CSRF 或使用同源严格策略及防伪令牌。
- 富文本和 SVG 在服务端清理。
- 外部 URL 只允许 `https` 和明确协议白名单。
- 上传签名限制存储路径、内容类型、大小和有效时间。
- 发布、权限和永久删除接口执行细粒度权限校验。
- 请求日志不记录密码、会话、上传签名或完整敏感正文。
