/**
 * Demo schema for the "Load SaaS Platform Sample" button. A much larger,
 * realistic multi-domain schema (auth, projects, billing, support) meant to
 * exercise the 3D layout and ticker at scale rather than to trip every
 * linter rule — every foreign key is explicit, typed to match its parent,
 * and indexed, so this one loads close to a clean Health 100.
 */
export const SAAS_PLATFORM_SAMPLE_SQL = `-- ============================================================
--  SaaS Platform — demo schema (large: auth, projects, billing, support)
-- ============================================================

CREATE TABLE plans (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  name             VARCHAR(80) NOT NULL UNIQUE,
  price_cents      INT NOT NULL,
  billing_interval VARCHAR(20) NOT NULL
);

CREATE TABLE organizations (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  plan_id    INT NULL,
  name       VARCHAR(160) NOT NULL,
  slug       VARCHAR(180) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_organizations_plan FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE SET NULL
);
CREATE INDEX idx_organizations_plan_id ON organizations (plan_id);

CREATE TABLE users (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  email           VARCHAR(255) NOT NULL UNIQUE,
  display_name    VARCHAR(120) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_users_organization_id ON users (organization_id);

CREATE TABLE roles (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  name            VARCHAR(80) NOT NULL,
  CONSTRAINT fk_roles_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_roles_organization_id ON roles (organization_id);

CREATE TABLE user_roles (
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
);
CREATE INDEX idx_user_roles_role_id ON user_roles (role_id);

CREATE TABLE teams (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  name            VARCHAR(120) NOT NULL,
  CONSTRAINT fk_teams_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_teams_organization_id ON teams (organization_id);

CREATE TABLE team_members (
  team_id INT NOT NULL,
  user_id INT NOT NULL,
  PRIMARY KEY (team_id, user_id),
  CONSTRAINT fk_team_members_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE,
  CONSTRAINT fk_team_members_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX idx_team_members_user_id ON team_members (user_id);

CREATE TABLE projects (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  team_id    INT NOT NULL,
  name       VARCHAR(160) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_projects_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE
);
CREATE INDEX idx_projects_team_id ON projects (team_id);

CREATE TABLE project_members (
  project_id INT NOT NULL,
  user_id    INT NOT NULL,
  PRIMARY KEY (project_id, user_id),
  CONSTRAINT fk_project_members_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_project_members_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX idx_project_members_user_id ON project_members (user_id);

CREATE TABLE milestones (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NOT NULL,
  title      VARCHAR(160) NOT NULL,
  due_date   DATE NULL,
  CONSTRAINT fk_milestones_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX idx_milestones_project_id ON milestones (project_id);

CREATE TABLE sprints (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NOT NULL,
  name       VARCHAR(120) NOT NULL,
  starts_on  DATE NOT NULL,
  ends_on    DATE NOT NULL,
  CONSTRAINT fk_sprints_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX idx_sprints_project_id ON sprints (project_id);

CREATE TABLE tasks (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  project_id   INT NOT NULL,
  sprint_id    INT NULL,
  milestone_id INT NULL,
  assignee_id  INT NULL,
  title        VARCHAR(200) NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'todo',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tasks_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_tasks_sprint FOREIGN KEY (sprint_id) REFERENCES sprints (id) ON DELETE SET NULL,
  CONSTRAINT fk_tasks_milestone FOREIGN KEY (milestone_id) REFERENCES milestones (id) ON DELETE SET NULL,
  CONSTRAINT fk_tasks_assignee FOREIGN KEY (assignee_id) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_tasks_project_id ON tasks (project_id);
CREATE INDEX idx_tasks_sprint_id ON tasks (sprint_id);
CREATE INDEX idx_tasks_milestone_id ON tasks (milestone_id);
CREATE INDEX idx_tasks_assignee_id ON tasks (assignee_id);

CREATE TABLE task_comments (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  task_id    INT NOT NULL,
  author_id  INT NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_task_comments_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
  CONSTRAINT fk_task_comments_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX idx_task_comments_task_id ON task_comments (task_id);
CREATE INDEX idx_task_comments_author_id ON task_comments (author_id);

CREATE TABLE task_attachments (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  task_id     INT NOT NULL,
  uploaded_by INT NOT NULL,
  file_url    VARCHAR(500) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_task_attachments_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
  CONSTRAINT fk_task_attachments_uploader FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX idx_task_attachments_task_id ON task_attachments (task_id);
CREATE INDEX idx_task_attachments_uploaded_by ON task_attachments (uploaded_by);

CREATE TABLE labels (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  name            VARCHAR(80) NOT NULL,
  color           CHAR(7) NOT NULL,
  CONSTRAINT fk_labels_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_labels_organization_id ON labels (organization_id);

CREATE TABLE task_labels (
  task_id  INT NOT NULL,
  label_id INT NOT NULL,
  PRIMARY KEY (task_id, label_id),
  CONSTRAINT fk_task_labels_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
  CONSTRAINT fk_task_labels_label FOREIGN KEY (label_id) REFERENCES labels (id) ON DELETE CASCADE
);
CREATE INDEX idx_task_labels_label_id ON task_labels (label_id);

CREATE TABLE time_entries (
  id        INT PRIMARY KEY AUTO_INCREMENT,
  task_id   INT NOT NULL,
  user_id   INT NOT NULL,
  minutes   INT NOT NULL,
  logged_on DATE NOT NULL,
  CONSTRAINT fk_time_entries_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
  CONSTRAINT fk_time_entries_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX idx_time_entries_task_id ON time_entries (task_id);
CREATE INDEX idx_time_entries_user_id ON time_entries (user_id);

CREATE TABLE invoices (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'open',
  total_cents     INT NOT NULL,
  issued_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoices_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_invoices_organization_id ON invoices (organization_id);

CREATE TABLE invoice_items (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  invoice_id  INT NOT NULL,
  description VARCHAR(200) NOT NULL,
  amount_cents INT NOT NULL,
  CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE
);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items (invoice_id);

CREATE TABLE payment_methods (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  brand           VARCHAR(40) NOT NULL,
  last4           CHAR(4) NOT NULL,
  CONSTRAINT fk_payment_methods_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_payment_methods_organization_id ON payment_methods (organization_id);

CREATE TABLE payments (
  id                INT PRIMARY KEY AUTO_INCREMENT,
  invoice_id        INT NOT NULL,
  payment_method_id INT NOT NULL,
  amount_cents      INT NOT NULL,
  paid_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_method FOREIGN KEY (payment_method_id) REFERENCES payment_methods (id) ON DELETE RESTRICT
);
CREATE INDEX idx_payments_invoice_id ON payments (invoice_id);
CREATE INDEX idx_payments_payment_method_id ON payments (payment_method_id);

CREATE TABLE subscriptions (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  plan_id         INT NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  renews_at       TIMESTAMP NOT NULL,
  CONSTRAINT fk_subscriptions_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE RESTRICT
);
CREATE INDEX idx_subscriptions_organization_id ON subscriptions (organization_id);
CREATE INDEX idx_subscriptions_plan_id ON subscriptions (plan_id);

CREATE TABLE webhooks (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  url             VARCHAR(500) NOT NULL,
  secret          VARCHAR(100) NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_webhooks_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_webhooks_organization_id ON webhooks (organization_id);

CREATE TABLE api_keys (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  created_by      INT NOT NULL,
  key_hash        VARCHAR(255) NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_api_keys_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_api_keys_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX idx_api_keys_organization_id ON api_keys (organization_id);
CREATE INDEX idx_api_keys_created_by ON api_keys (created_by);

CREATE TABLE notifications (
  id      INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title   VARCHAR(160) NOT NULL,
  body    TEXT NOT NULL,
  read_at TIMESTAMP NULL,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX idx_notifications_user_id ON notifications (user_id);

CREATE TABLE integrations (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  provider        VARCHAR(60) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'connected',
  connected_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_integrations_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_integrations_organization_id ON integrations (organization_id);

CREATE TABLE support_tickets (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  opened_by       INT NOT NULL,
  subject         VARCHAR(200) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_support_tickets_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_support_tickets_opener FOREIGN KEY (opened_by) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX idx_support_tickets_organization_id ON support_tickets (organization_id);
CREATE INDEX idx_support_tickets_opened_by ON support_tickets (opened_by);

CREATE TABLE ticket_replies (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  ticket_id  INT NOT NULL,
  author_id  INT NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ticket_replies_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets (id) ON DELETE CASCADE,
  CONSTRAINT fk_ticket_replies_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX idx_ticket_replies_ticket_id ON ticket_replies (ticket_id);
CREATE INDEX idx_ticket_replies_author_id ON ticket_replies (author_id);

CREATE TABLE audit_logs (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  actor_id        INT NULL,
  action          VARCHAR(80) NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_audit_logs_organization_id ON audit_logs (organization_id);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs (actor_id);
`;
