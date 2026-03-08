-- =============================================
-- BizPlan AI - Initial Schema Migration
-- =============================================

-- 1. users (auth.users와 연동되는 프로필)
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. projects
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  business_idea text,
  target_market text,
  problem_description text,
  solution_summary text,
  team_info text,
  support_program text NOT NULL DEFAULT '예비창업패키지',
  total_score int,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. sections
CREATE TABLE public.sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  section_type text NOT NULL CHECK (section_type IN ('problem', 'solution', 'scale', 'team')),
  content text NOT NULL DEFAULT '',
  ai_score int,
  ai_feedback jsonb,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. payments
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  amount int NOT NULL,
  currency text NOT NULL DEFAULT 'KRW',
  status text NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'tosspayments',
  payment_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for FK and RLS
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_sections_project_id ON public.sections(project_id);
CREATE INDEX idx_payments_user_id ON public.payments(user_id);

-- =============================================
-- Row Level Security (RLS)
-- =============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- users: 자기 자신의 row만 SELECT/UPDATE
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (id = auth.uid());

-- projects: 자기 프로젝트만 CRUD
CREATE POLICY "projects_select_own"
  ON public.projects FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "projects_insert_own"
  ON public.projects FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_update_own"
  ON public.projects FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "projects_delete_own"
  ON public.projects FOR DELETE
  USING (user_id = auth.uid());

-- sections: 자기 프로젝트의 섹션만 CRUD
CREATE POLICY "sections_select_own"
  ON public.sections FOR SELECT
  USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

CREATE POLICY "sections_insert_own"
  ON public.sections FOR INSERT
  WITH CHECK (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

CREATE POLICY "sections_update_own"
  ON public.sections FOR UPDATE
  USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

CREATE POLICY "sections_delete_own"
  ON public.sections FOR DELETE
  USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

-- payments: 자기 결제 내역만 SELECT
CREATE POLICY "payments_select_own"
  ON public.payments FOR SELECT
  USING (user_id = auth.uid());

-- (결제 생성은 서버/서비스 롤에서 처리하는 경우가 많으므로 INSERT 정책은 필요 시 별도 추가)

-- =============================================
-- updated_at 자동 갱신 트리거
-- =============================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER sections_updated_at
  BEFORE UPDATE ON public.sections
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();
