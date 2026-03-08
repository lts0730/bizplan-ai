import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { PROGRAMS } from '@/lib/evaluation-criteria'

const SECTION_TYPES = ['problem', 'solution', 'scale', 'team'] as const
type SectionType = (typeof SECTION_TYPES)[number]

function isSectionType(s: string): s is SectionType {
  return SECTION_TYPES.includes(s as SectionType)
}

function buildSystemPrompt(
  sectionCriteria: { criteria: Array<{ name: string; weight: number; description: string; checkpoints: string[] }> },
  project: {
    title: string | null
    business_idea: string | null
    target_market: string | null
    problem_description: string | null
    solution_summary: string | null
    team_info: string | null
  }
): string {
  const criteriaJson = JSON.stringify(sectionCriteria.criteria, null, 2)
  return `너는 정부지원사업 사업계획서 전문 컨설턴트야. 20년 경력의 대한민국 최고 사업계획서 작성 전문가로서, 평가위원이 높은 점수를 줄 수 있는 사업계획서를 작성해.

[작성 규칙]
1. 개조식으로 작성 (문장으로 끝나도록, 글머리 기호 사용하지 말 것. 특히, 정부 사업계획서 작성 템플릿에 맞춰서 작성할 것)
2. 구체적 수치와 데이터를 반드시 포함 (시장규모, 성장률, 고객 수 등)
3. 출처를 명시할 수 있는 데이터는 출처 표기
4. 논리적 흐름: 현황 분석 → 문제 도출 → 근거 제시 → 시사점
5. 전문적이지만 평가위원이 읽기 쉬운 문체
6. 2000~2500자 분량

[평가 기준]
아래 기준에서 높은 점수를 받을 수 있도록 작성해:
${criteriaJson}

[사업 정보]
- 사업명: ${project.title ?? '(미입력)'}
- 사업 아이디어: ${project.business_idea ?? '(미입력)'}
- 타겟 고객: ${project.target_market ?? '(미입력)'}
- 해결하려는 문제: ${project.problem_description ?? '(미입력)'}
- 솔루션: ${project.solution_summary ?? '(미입력)'}
- 팀 정보: ${project.team_info ?? '(미입력)'}`
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let body: { projectId?: string; sectionType?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: '요청 본문이 올바른 JSON이 아닙니다.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { projectId, sectionType } = body
  if (!projectId || typeof projectId !== 'string') {
    return new Response(
      JSON.stringify({ error: 'projectId가 필요합니다.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
  if (!sectionType || !isSectionType(sectionType)) {
    return new Response(
      JSON.stringify({ error: "sectionType은 'problem' | 'solution' | 'scale' | 'team' 중 하나여야 합니다." }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response(
      JSON.stringify({ error: '인증이 필요합니다.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, title, business_idea, target_market, problem_description, solution_summary, team_info, support_program')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    return new Response(
      JSON.stringify({ error: '프로젝트를 찾을 수 없습니다.' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const program = PROGRAMS[project.support_program ?? '예비창업패키지']
  if (!program) {
    return new Response(
      JSON.stringify({ error: '지원 프로그램 평가기준을 찾을 수 없습니다.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const sectionCriteria = program.sections[sectionType]
  if (!sectionCriteria) {
    return new Response(
      JSON.stringify({ error: `섹션 타입 '${sectionType}'에 대한 평가기준이 없습니다.` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const systemPrompt = buildSystemPrompt(sectionCriteria, project)
  const userMessage = `위 사업 정보를 바탕으로 '${sectionCriteria.koreanName}' 섹션을 작성해줘.`

  const anthropic = new Anthropic({ apiKey })
  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        })

        stream.on('text', (textDelta) => {
          controller.enqueue(encoder.encode(textDelta))
        })

        stream.on('error', (err) => {
          controller.error(err)
        })

        const fullText = await stream.finalText()

        const { data: existingSection } = await supabase
          .from('sections')
          .select('id, version')
          .eq('project_id', projectId)
          .eq('section_type', sectionType)
          .single()

        if (existingSection) {
          await supabase
            .from('sections')
            .update({
              content: fullText,
              version: (existingSection.version ?? 1) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingSection.id)
        } else {
          await supabase.from('sections').insert({
            project_id: projectId,
            section_type: sectionType,
            content: fullText,
            version: 1,
          })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '알 수 없는 오류'
        if (
          message.includes('overloaded') ||
          message.includes('rate') ||
          message.includes('token')
        ) {
          controller.enqueue(
            encoder.encode(`\n[오류: ${message}. 잠시 후 다시 시도해 주세요.]`)
          )
        } else {
          controller.error(err)
          return
        }
      } finally {
        try {
          controller.close()
        } catch {
          // already closed or errored
        }
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
