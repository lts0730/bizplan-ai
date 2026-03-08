import { createClient } from '@/lib/supabase/middleware'
import { type NextRequest, NextResponse } from 'next/server'

function isPublicPath(pathname: string): boolean {
  if (pathname === '/' || pathname === '/login') return true
  if (pathname.startsWith('/auth') || pathname.startsWith('/api') || pathname.startsWith('/_next'))
    return true
  return false
}

export async function middleware(request: NextRequest) {
  const { supabase, response } = await createClient(request)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (isPublicPath(request.nextUrl.pathname)) {
    return response
  }

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * 다음을 제외한 모든 경로에서 실행:
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화)
     * - favicon.ico
     * - 이미지/폰트 등 정적 에셋
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
