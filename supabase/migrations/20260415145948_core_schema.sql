-- updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. core_organisations (Multi-tenant base)
CREATE TABLE core_organisations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER set_core_organisations_updated_at
BEFORE UPDATE ON core_organisations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. core_roles (RBAC base)
CREATE TABLE core_roles (
    name TEXT PRIMARY KEY,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insert required default roles
INSERT INTO core_roles (name, description) VALUES
('super_admin', 'Full system access'),
('manager', 'Agency manager'),
('employee', 'Agency employee'),
('account_manager', 'Client account manager'),
('client_admin', 'Client administrator'),
('client_viewer', 'Client viewer only');

-- 3. core_users (Extends auth.users)
CREATE TABLE core_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES core_organisations(id) ON DELETE RESTRICT,
    role TEXT NOT NULL REFERENCES core_roles(name) ON DELETE RESTRICT DEFAULT 'employee',
    display_name TEXT,
    email TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_core_users_org_id ON core_users(org_id);
CREATE INDEX idx_core_users_role ON core_users(role);

CREATE TRIGGER set_core_users_updated_at
BEFORE UPDATE ON core_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. core_permissions
CREATE TABLE core_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name TEXT REFERENCES core_roles(name) ON DELETE CASCADE,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(role_name, resource, action)
);

-- 5. core_audit_log
CREATE TABLE core_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES core_users(id) ON DELETE SET NULL,
    org_id UUID REFERENCES core_organisations(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_core_audit_log_org_id ON core_audit_log(org_id);
CREATE INDEX idx_core_audit_log_user_id ON core_audit_log(user_id);
CREATE INDEX idx_core_audit_log_created_at ON core_audit_log(created_at);

-- 6. core_notifications
CREATE TABLE core_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES core_users(id) ON DELETE CASCADE NOT NULL,
    org_id UUID REFERENCES core_organisations(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_core_notifications_user_id ON core_notifications(user_id);
CREATE INDEX idx_core_notifications_is_read ON core_notifications(is_read);

-- 7. core_settings
CREATE TABLE core_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES core_organisations(id) ON DELETE CASCADE NOT NULL,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(org_id, key)
);

CREATE TRIGGER set_core_settings_updated_at
BEFORE UPDATE ON core_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ROW LEVEL SECURITY (RLS) --
ALTER TABLE core_organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's org_id
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM core_users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM core_users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE;

-- RLS Policies

-- core_organisations
CREATE POLICY "Users can view their own organisation"
ON core_organisations FOR SELECT TO authenticated
USING (id = get_user_org_id() OR get_user_role() = 'super_admin');

-- core_users
CREATE POLICY "Users can view others in their org"
ON core_users FOR SELECT TO authenticated
USING (org_id = get_user_org_id() OR get_user_role() = 'super_admin');

CREATE POLICY "Users can update their own profile"
ON core_users FOR UPDATE TO authenticated
USING (id = auth.uid());

-- core_roles & core_permissions (readable by all authenticated)
CREATE POLICY "Roles are viewable by everyone" ON core_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permissions are viewable by everyone" ON core_permissions FOR SELECT TO authenticated USING (true);

-- core_audit_log
CREATE POLICY "Admins can view org audit logs"
ON core_audit_log FOR SELECT TO authenticated
USING (
  (org_id = get_user_org_id() AND get_user_role() IN ('manager', 'super_admin'))
  OR get_user_role() = 'super_admin'
);

-- core_notifications
CREATE POLICY "Users can manage their own notifications"
ON core_notifications FOR ALL TO authenticated
USING (user_id = auth.uid());

-- core_settings
CREATE POLICY "Admins can manage org settings"
ON core_settings FOR ALL TO authenticated
USING (
  (org_id = get_user_org_id() AND get_user_role() IN ('manager', 'super_admin', 'client_admin'))
  OR get_user_role() = 'super_admin'
);
