# HKBA 管理員手冊（Phase 2）

適用版本：Phase 2（M0–M9）。本文面向內容管理員與運維人員，涵蓋登入與角色、後台各工作區、內容發佈流、回收站、備份與常見錯誤恢復。

---

## 1. 登入與角色

- 後台入口：`/admin/login`。
- 首次部署空資料庫時會建立 `admin` 帳號，密碼必須由 GitHub Secret `ADMIN_INITIAL_PASSWORD` 提供（至少 12 個字元）。已有 `admin` 帳號的生產資料庫可不配置此 Secret；正式環境的新資料庫未配置安全密碼時會拒絕初始化，`hkba2024` 僅保留為本地開發回退值。
- 會話以 `hkba_admin` HttpOnly Cookie 維持；登出調用 `POST /api/auth/logout`。

系統內建三種角色（寫入 `roles` / `user_roles` 表，idempotent 種子）：

| 角色 | 權限 | 說明 |
| --- | --- | --- |
| `super_admin` | 全部（content.read / content.write / publish / rollback / media.delete / system.admin） | 超級管理員；**id 最小的 admin 帳號自動獲得**，保證全新部署永不鎖死 |
| `editor` | content.read, content.write | 內容編輯：頁面、新聞、媒體編輯與草稿保存，**不能發佈** |
| `publisher` | content.read, publish, rollback | 發佈人員：檢查、預覽、發佈、撤回、回退，**不能改草稿** |

典型分工：editor 撰稿存草稿 → publisher 預覽檢查後發佈；兩者分離可防誤發。

## 2. 後台導航（星系導航）

管理後台首頁 `/admin` 以星系式導航進入各工作區：

- **欄目頁面** `/admin/pages` — 頁面樹（section/page 節點）、建立、移動、複製、刪除（進回收站）、還原。
- **工作室** `/admin/studio` — 組件工作室，瀏覽 30 種註冊組件的定義與 schema。
- **新聞中心** `/admin/news` — 新聞列表、分類與標籤（taxonomy）管理。
- **媒體庫** `/admin/media` — 媒體資產上傳、引用檢查、回收站。
- 其他：`/admin/banners`、`/admin/team`、`/admin/members`、`/admin/events`、`/admin/messages`、`/admin/settings`（舊結構化管理頁，Phase 2 保留）。

## 3. 欄目頁面

- 頁面樹由 `section`（欄目，僅導航用）與 `page`（可發佈頁面）兩類節點組成；slug 在同一父節點下唯一。
- 每個 page 節點有「已發佈版本 + 當前草稿」雙版本結構；草稿修訂號持續遞增，發佈不清零。
- 刪除節點 = 軟刪除（`deleted_at`），可在回收站還原（`POST /api/admin/pages/:id/restore`）。

## 4. 工作室組件

- 共 30 種註冊組件（如 `content.hero`、`content.rich-text`、`content.stats`、`association.members`、`association.timeline`、`news.header` 等），每種有版本化 schema（content / settings 雙語欄位）。
- 頁面區塊與新聞區塊共用同一渲染器；`GET /api/admin/components/definitions` 返回完整註冊表。

## 5. 新聞中心

- 新聞 = `news_items` + 修訂（`news_revisions`）+ 區塊（`news_blocks`，固定含 `news.header` + 正文區塊）。
- 分類（`news_categories`）與標籤（`news_tags`）獨立管理，slug 自動生成；中文名稱會落到 `cat-/tag-` 前綴的 hash slug。
- 已發佈新聞的舊數字網址（`/news/<id>`）由 redirects 表 301 到新 slug 網址（決策 D8）；**301 在 Next.js 構建時生效，新增 redirect 行需重新構建前端後才產生真正的 301 跳轉**。

## 6. 媒體庫

- 上傳按內容 sha256 去重；相同檔案重複上傳會複用同一資產。
- 資產被頁面/新聞引用時不可硬刪除；未引用資產可刪除（`media.delete` 權限）。
- SEO 社交分享圖必須是 `active` 狀態的媒體資產，否則發佈檢查攔截。

## 7. 草稿 / 預覽 / 發佈 / 回退

1. **存草稿**：編輯區塊或 SEO 後保存，每次修改修訂號 +1（攜帶 `expectedRevision` 樂觀鎖）。
2. **預覽**：`POST /api/admin/pages/:id/preview` 生成釘住當前草稿的預覽 token，前端 `/admin/preview/<token>` 查看；預覽響應帶 `noindex` + `no-store`。**草稿再被修改後，舊預覽立即失效（410）**。
3. **發佈**：`POST /:id/publish` 觸發發佈檢查（必填雙語、SEO 完整含分享圖、內部連結可解析、媒體可用），全部通過才原子切換已發佈版本，並寫入 `publish_records` 與審計日誌。檢查失敗返回 422 `PUBLISH_CHECK_FAILED`，`error.fields` 逐條列出問題（如 `seo_incomplete`、`media_missing`、`link_unresolved`）。
4. **撤回 / 回退**：`POST /:id/withdraw` 下架；`POST /:id/rollback` 回到任一歷史已發佈版本（`rollback` 權限）。

## 8. 回收站

- 頁面節點與媒體均為軟刪除；還原後回到原位置/原狀態。
- 定期人工清理回收站前，請先確認無待還原內容；媒體硬刪除不可恢復。

## 9. 備份與定時任務

`backend/scripts/backup-db.js` 使用 SQLite 在線備份 API，把一致性快照寫入 `backend/db/backups/hkba.<時間戳>.bak`，可包含尚在 WAL 中的已提交資料，並清理超過保留天數（預設 30 天）的舊備份。GitHub Actions 每次部署會在重啟 API 前自動執行一次；資料庫尚未建立的首次部署會跳過。

建議 crontab（每日 03:17，避開整點）：

```cron
17 3 * * * cd /path/to/hkba/backend && node scripts/backup-db.js >> /var/log/hkba-backup.log 2>&1
```

- 自訂：`--db <路徑>`、`--dir <備份目錄>`、`--keep-days <天數>`。
- 內容遷移（`backend/scripts/migrate-content.js`）在寫入前也會自動做一次檔案備份（可用 `--no-backup` 跳過）。
- `backend/scripts/migrate-content.js` 仍保留同步檔案備份供離線遷移使用；在線服務與定時任務應直接運行上述 CLI，避免手工複製主 `.db` 文件而漏掉 WAL 資料。

資料庫回退：先 `pm2 stop hkba-api`，保留當前失敗資料庫副本，再把選定 `.bak` 複製為 `backend/db/hkba.db`，執行 `chown www:www`，重啟 API 並訪問 `http://127.0.0.1:37900/api/health` 確認 `status=ok`，最後重啟前端並 `pm2 save`。

## 10. 常見錯誤與恢復

| 錯誤碼 | 含義 | 處理 |
| --- | --- | --- |
| `VALIDATION_FAILED` (400) | 欄位校驗失敗（如 slug 非法） | 按 `error.fields` 逐項修正後重試 |
| `REVISION_CONFLICT` (409) | `expectedRevision` 過期（他人已保存） | 重新拉取草稿（`GET .../draft`），基於最新修訂號重放修改；不要強制覆蓋 |
| `REFERENCE_EXISTS` (409) | 同父節點下 slug 重複等引用衝突 | 更換 slug 或先處理既有節點 |
| `PUBLISH_CHECK_FAILED` (422) | 發佈檢查未過 | 逐條修復 `error.fields`：`seo_incomplete`（補標題/描述/分享圖）、`media_missing`/`media_unavailable`（換用 active 媒體）、`link_unresolved`（內部連結目標未發佈或不存在，可先建 redirect） |
| `NOT_PUBLISHED` (404) | 公開 API 訪問了未發佈頁面 | 先發佈；或確認路徑是否打錯 |
| `UPLOAD_REJECTED` | 上傳類型/大小不符 | 換用允許的圖片格式與尺寸 |
| 預覽 410 | 預覽 token 已過期（草稿有新修改） | 重新生成預覽 |
| 公開頁面 404 但已發佈 | 前端構建早於發佈 | 動態渲染頁面會即時生效；**redirect 301 需重新構建前端** |
| 遷移後內容缺失 | 見遷移報告 `failures` / `unmapped` | 重跑 `migrate-content.js`（幂等，只補失敗行）；外部圖床圖片屬預期 unmapped |

審計排障：所有管理操作寫入 `audit_events`（含 actor、action、object、user-agent），發佈/回退另有 `publish_records` 日誌，可按 object_id 反查責任鏈。
