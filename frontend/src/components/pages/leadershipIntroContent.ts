import type { Lang } from '@/lib/api';

export interface LeadershipIntroContent {
  eyebrow: string;
  title: string;
  lead: string;
  responsibility: string;
  scopeLabel: string;
  scope: string[];
  compositionLabel: string;
  composition: Array<{
    title: string;
    description: string;
  }>;
}

const content: Record<Lang, LeadershipIntroContent> = {
  zh: {
    eyebrow: '協會治理',
    title: '領導委員會',
    lead: '凝聚跨領域經驗，為香港區塊鏈生態建立清晰而長遠的方向。',
    responsibility: '領導委員會負責制定協會的策略方向、推動重要行業倡議，並連結企業、學術界、專業機構及公共部門，確保協會工作回應會員與產業的實際需要。',
    scopeLabel: '核心職責',
    scope: ['策略規劃', '行業倡議', '生態協作'],
    compositionLabel: '委員會組成',
    composition: [
      { title: '主席團', description: '確立發展方向，統籌協會治理及重要對外事務。' },
      { title: '專業委員', description: '匯聚產業實務經驗，推動專項議題與會員合作。' },
      { title: '顧問團隊', description: '提供政策、技術、學術及市場層面的專業意見。' },
    ],
  },
  en: {
    eyebrow: 'Association governance',
    title: 'Leadership Committee',
    lead: 'Bringing together cross-sector experience to shape a clear, long-term direction for Hong Kong’s blockchain ecosystem.',
    responsibility: 'The Leadership Committee sets the association’s strategic direction, advances key industry initiatives and connects businesses, academia, professional institutions and the public sector so HKBA’s work reflects the practical needs of its members and the wider industry.',
    scopeLabel: 'Core responsibilities',
    scope: ['Strategy', 'Industry initiatives', 'Ecosystem collaboration'],
    compositionLabel: 'Committee composition',
    composition: [
      { title: 'Chairmanship', description: 'Sets direction and oversees governance and major external affairs.' },
      { title: 'Committee Members', description: 'Bring industry experience to focused initiatives and member collaboration.' },
      { title: 'Advisory Network', description: 'Provides policy, technology, academic and market perspectives.' },
    ],
  },
};

export function getLeadershipIntro(lang: Lang): LeadershipIntroContent {
  return content[lang];
}
