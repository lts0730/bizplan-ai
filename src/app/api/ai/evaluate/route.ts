import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { PROGRAMS } from '@/lib/evaluation-criteria'

export interface EvaluateResponse {
  score: number
  maxScore: number
  criteriaScores: Array<{
    name: string
    score: number
    maxScore: number
    feedback: string
  }>
  strengths: string[]
  improvements: string[]
  critical: string[]
}

const SECTION_TYPES = ['problem', 'solution', 'scale', 'team'] as const

function buildSystemPrompt(sectionCriteria: {
  koreanName: string
  maxScore: number
  criteria: Array<{ name: string; weight: number; description: string; checkpoints: string[] }>
}): string {
  const criteriaWithCheckpoints = sectionCriteria.criteria.map((c) => ({
    name: c.name,
    maxScore: c.weight,
    description: c.description,
    checkpoints: c.checkpoints,
  }))
  const criteriaJson = JSON.stringify(criteriaWithCheckpoints, null, 2)
  return `너는 정부지원사업 사업계획서 평가위원이야. 20년 경력의 엄격하지만 건설적인 평가위원으로서, 아래 평가 기준에 따라 정확하게 점수를 매기고 구체적인 피드백을 제공해.

[역할]
- 실제 평가위원처럼 각 항목별로 점수를 매겨
- 점수는 반드시 정수로 (소수점 X)
- 피드백은 구체적이고 액션 가능하게
- 한국어로 답변

[평가 기준]
${criteriaJson}

[응답 형식 - 반드시 아래 JSON 형식으로만 답변]
{
  "score": (총점),
  "maxScore": (만점),
  "criteriaScores": [
    {
      "name": "(항목명)",
      "score": (점수),
      "maxScore": (배점),
      "feedback": "(구체적 피드백)"
    }
  ],
  "strengths": ["(잘된 점 1)", "(잘된 점 2)"],
  "improvements": ["(개선할 점 1)", "(개선할 점 2)"],
  "critical": ["(치명적 문제가 있으면 여기에. 없으면 빈 배열)"]
}`
}

function parseEvaluateJson(text: string): EvaluateResponse | null {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown
    if (parsed && typeof parsed === 'object' && 'score' in parsed && 'maxScore' in parsed) {
      const p = parsed as Record<string, unknown>
      return {
        score: Number(p.score),
        maxScore: Number(p.maxScore),
        criteriaScores: Array.isArray(p.criteriaScores)
          ? (p.criteriaScores as EvaluateResponse['criteriaScores'])
          : [],
        strengths: Array.isArray(p.strengths) ? (p.strengths as string[]) : [],
        improvements: Array.isArray(p.improvements) ? (p.improvements as string[]) : [],
        critical: Array.isArray(p.critical) ? (p.critical as string[]) : [],
      }
    }
  } catch {
    // ignore
  }
  return null
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
  if (!sectionType || typeof sectionType !== 'string') {
    return new Response(
      JSON.stringify({ error: 'sectionType이 필요합니다.' }),
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

  const { data: section, error: sectionError } = await supabase
    .from('sections')
    .select('id, content, project_id')
    .eq('project_id', projectId)
    .eq('section_type', sectionType)
    .single()

  if (sectionError || !section) {
    return new Response(
      JSON.stringify({ error: '해당 섹션을 찾을 수 없습니다.' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const content = section.content ?? ''
  if (!content.trim()) {
    return new Response(
      JSON.stringify({ error: '평가할 내용이 없습니다. 먼저 섹션 초안을 생성해 주세요.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { data: project } = await supabase
    .from('projects')
    .select('support_program')
    .eq('id', section.project_id)
    .single()

  const program = PROGRAMS[project?.support_program ?? '예비창업패키지']
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

  const systemPrompt = buildSystemPrompt(sectionCriteria)
  const userMessage = `아래 사업계획서의 '${sectionCriteria.koreanName}' 섹션을 평가해줘:\n\n${content}`

  const anthropic = new Anthropic({ apiKey })
  const maxRetries = 2
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      })

      const textBlock = message.content.find((b) => b.type === 'text')
      const text = textBlock && 'text' in textBlock ? textBlock.text : ''
      const result = parseEvaluateJson(text)

      if (!result) {
        lastError = new Error('JSON 파싱 실패')
        continue
      }

      await supabase
        .from('sections')
        .update({
          ai_score: result.score,
          ai_feedback: result as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq('id', section.id)

      const { data: allSections } = await supabase
        .from('sections')
        .select('ai_score')
        .eq('project_id', projectId)
        .in('section_type', SECTION_TYPES)

      const totalScore = (allSections ?? [])
        .map((s) => (s.ai_score != null ? s.ai_score : 0))
        .reduce((a, b) => a + b, 0)

      await supabase
        .from('projects')
        .update({ total_score: totalScore, updated_at: new Date().toISOString() })
        .eq('id', projectId)

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (err) {
      lastError = err
      const message = err instanceof Error ? err.message : String(err)
      if (
        message.includes('overloaded') ||
        message.includes('rate') ||
        message.includes('token') ||
        message.includes('500')
      ) {
        return new Response(
          JSON.stringify({ error: 'Claude API 일시 오류. 잠시 후 다시 시도해 주세요.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }
  }

  return new Response(
    JSON.stringify({
      error: '평가 결과를 파싱하지 못했습니다.',
      detail: lastError instanceof Error ? lastError.message : String(lastError),
    }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  )
}
