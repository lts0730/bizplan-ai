import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-slate-100 mb-2">대시보드</h1>
        <p className="text-slate-400">
          {user?.email ?? '로그인됨'}으로 로그인되었습니다.
        </p>
      </div>
    </div>
  )
}
