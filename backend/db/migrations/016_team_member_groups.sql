-- Configurable team identity structure. Existing member rows keep referencing
-- stable identity codes through team_members.group_name.

CREATE TABLE IF NOT EXISTS team_member_groups (
  code TEXT PRIMARY KEY,
  label_zh TEXT NOT NULL,
  label_en TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  is_legacy INTEGER NOT NULL DEFAULT 0 CHECK (is_legacy IN (0, 1)),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO team_member_groups (code, label_zh, label_en, sort_order) VALUES
  ('honorary_chairman', '榮譽主席', 'Honorary Chairman', 10),
  ('chairman', '會長', 'Chairman', 20),
  ('vice_chairman', '副會長', 'Vice Chairman', 30),
  ('committee', '委員', 'Committee Member', 40),
  ('advisor', '顧問', 'Advisor', 50);

INSERT OR IGNORE INTO team_member_groups (code, label_zh, label_en, sort_order, is_active, is_legacy)
SELECT group_name, group_name, group_name, 1000 + MIN(id), 1, 1
FROM team_members
WHERE TRIM(group_name) <> ''
GROUP BY group_name;
