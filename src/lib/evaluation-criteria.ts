export interface CriterionItem {
  name: string
  weight: number
  description: string
  checkpoints: string[]
}

export interface SectionCriteria {
  name: string
  koreanName: string
  maxScore: number
  criteria: CriterionItem[]
}

export interface ProgramCriteria {
  programName: string
  totalScore: number
  sections: Record<string, SectionCriteria>
}

export const PROGRAMS: Record<string, ProgramCriteria> = {
  예비창업패키지: {
    programName: "예비창업패키지",
    totalScore: 100,
    sections: {
      problem: {
        name: "problem",
        koreanName: "문제인식 (Problem)",
        maxScore: 30,
        criteria: [
          {
            name: "고객 문제의 구체성",
            weight: 10,
            description:
              "타겟 고객의 Pain Point가 구체적 데이터와 사례로 뒷받침되는가",
            checkpoints: [
              "타겟 고객군이 명확하게 정의되어 있는가",
              "고객 인터뷰, 설문, 통계 등 근거 데이터가 있는가",
              "문제의 심각성이 수치로 표현되어 있는가",
            ],
          },
          {
            name: "시장 규모와 성장성",
            weight: 10,
            description: "TAM/SAM/SOM이 명확하고 신뢰할 수 있는 출처가 있는가",
            checkpoints: [
              "TAM(전체시장), SAM(유효시장), SOM(목표시장)이 구분되어 있는가",
              "시장 규모 출처가 신뢰할 수 있는 기관인가 (통계청, 산업연구원 등)",
              "시장 성장률(CAGR)이 제시되어 있는가",
            ],
          },
          {
            name: "문제의 시급성",
            weight: 10,
            description: "지금 이 문제를 풀어야 하는 이유가 설득력 있는가",
            checkpoints: [
              "규제 변화, 기술 발전, 사회 트렌드 등 타이밍 근거가 있는가",
              "문제를 방치했을 때의 비용/리스크가 제시되어 있는가",
              "기존 대안의 한계가 구체적으로 설명되어 있는가",
            ],
          },
        ],
      },
      solution: {
        name: "solution",
        koreanName: "솔루션 (Solution)",
        maxScore: 25,
        criteria: [
          {
            name: "솔루션의 혁신성",
            weight: 10,
            description: "기존 대안 대비 차별화된 접근인가",
            checkpoints: [
              "기존 경쟁사/대안과의 비교표가 있는가",
              "핵심 차별점이 명확한가 (기술, 비용, UX 등)",
              "Why Now: 이 솔루션이 지금 가능한 이유가 있는가",
            ],
          },
          {
            name: "기술적 실현 가능성",
            weight: 8,
            description: "현재 기술로 구현 가능하고 MVP가 있는가",
            checkpoints: [
              "핵심 기술 스택이 명시되어 있는가",
              "프로토타입/MVP 개발 현황이 있는가",
              "기술적 리스크와 대응 방안이 있는가",
            ],
          },
          {
            name: "비즈니스 모델 명확성",
            weight: 7,
            description: "수익 구조가 구체적이고 단가/마진이 합리적인가",
            checkpoints: [
              "수익 모델이 구체적인가 (구독, 건당, 수수료 등)",
              "단가와 예상 마진이 제시되어 있는가",
              "초기 매출 계획이 현실적인가",
            ],
          },
        ],
      },
      scale: {
        name: "scale",
        koreanName: "성장전략 (Scale)",
        maxScore: 25,
        criteria: [
          {
            name: "Go-to-Market 전략",
            weight: 10,
            description: "초기 고객 확보 방안이 구체적인가",
            checkpoints: [
              "초기 100명/1000명 고객 확보 전략이 구체적인가",
              "마케팅 채널과 예상 CAC가 있는가",
              "초기 고객 확보 실험/검증 결과가 있는가",
            ],
          },
          {
            name: "확장 계획",
            weight: 8,
            description: "스케일업 경로가 단계적이고 현실적인가",
            checkpoints: [
              "1년/3년 성장 마일스톤이 있는가",
              "확장 시 필요한 자원(인력, 자금)이 계획되어 있는가",
              "해외 진출 또는 인접 시장 확장 계획이 있는가",
            ],
          },
          {
            name: "경쟁 우위 지속성",
            weight: 7,
            description: "진입장벽(Moat)이 있는가",
            checkpoints: [
              "네트워크 효과, 데이터, 특허 등 해자가 있는가",
              "후발주자 대비 방어 전략이 있는가",
              "장기적 경쟁 우위 확보 방안이 있는가",
            ],
          },
        ],
      },
      team: {
        name: "team",
        koreanName: "팀구성 (Team)",
        maxScore: 20,
        criteria: [
          {
            name: "대표자 역량",
            weight: 8,
            description: "관련 경험, 전문성, 실행력이 있는가",
            checkpoints: [
              "해당 산업/기술 관련 경력이 있는가",
              "이전 창업 또는 프로젝트 성과가 있는가",
              "문제에 대한 깊은 이해를 보여주는가",
            ],
          },
          {
            name: "팀 구성 적합성",
            weight: 7,
            description: "핵심 직무가 커버되고 역할이 명확한가",
            checkpoints: [
              "기술, 비즈니스, 마케팅 등 핵심 역할이 커버되는가",
              "각 팀원의 역할과 기여가 명확한가",
              "부족한 역량에 대한 보완 계획이 있는가",
            ],
          },
          {
            name: "실행 계획",
            weight: 5,
            description: "12개월 마일스톤이 구체적이고 자금이 합리적인가",
            checkpoints: [
              "월별 또는 분기별 실행 계획이 있는가",
              "정부지원금 사용 계획이 항목별로 합리적인가",
              "KPI가 명확하고 측정 가능한가",
            ],
          },
        ],
      },
    },
  },
}
