-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DEVELOPER PROJECTS & CREDENTIALS TABLE
CREATE TABLE IF NOT EXISTS public.developer_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL DEFAULT 'Default Project',
    destination_wallet TEXT NOT NULL,
    webhook_url TEXT,
    public_api_key TEXT UNIQUE NOT NULL,
    secret_api_key_hash TEXT NOT NULL,
    webhook_secret TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. WEBHOOK DELIVERY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.developer_projects(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    order_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    response_body TEXT,
    dispatched_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.developer_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Developers can only view & edit their own projects
CREATE POLICY "Users can manage their own developer projects"
    ON public.developer_projects
    FOR ALL
    USING (auth.uid() = user_id);

-- Policy: Developers can only view webhook logs belonging to their projects
CREATE POLICY "Users can view logs for their own projects"
    ON public.webhook_logs
    FOR SELECT
    USING (
        project_id IN (
            SELECT id FROM public.developer_projects WHERE user_id = auth.uid()
        )
    );

-- Indexing for fast query lookups during high-volume API requests
CREATE INDEX IF NOT EXISTS idx_dev_projects_pubkey ON public.developer_projects(public_api_key);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_project_id ON public.webhook_logs(project_id);
