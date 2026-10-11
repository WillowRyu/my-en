export type ModuleId = 'greetings' | 'numbers' | 'cafe' | 'daily' | 'hobbies' | 'directions' | 'shopping' | 'plans'
export interface Phrase {
  id: string; version: number; moduleId: ModuleId; en: string; ko: string
  context: string; hint: string; choices: string[]; tokens: string[]; audio: string
}
export interface Lesson {
  id: string; version: number; day: number; title: string; goal: string; scene: string
  newPhraseIds: string[]; reusePhraseIds: string[]
}
const phrase = (id: string, moduleId: ModuleId, en: string, ko: string, context: string, hint: string, wrong: string[]): Phrase => ({
  id, version: 1, moduleId, en, ko, context, hint, choices: [ko, ...wrong],
  tokens: en.split(' '), audio: `/audio/${id}.wav`,
})

// Original beginner content. No copied course text or recordings.
export const phrases: Phrase[] = [
  phrase('hello', 'greetings', 'Hello.', '안녕하세요.', '처음 만난 사람에게 짧게 인사해요.', '처음 소리는 “헬”로 시작해요.', ['감사합니다.', '잘 가요.']),
  phrase('name', 'greetings', "I'm Ryu.", '저는 류예요.', '류는 연습용 이름이에요. 나중에는 내 이름으로 말해 보세요.', 'I’m은 I am을 짧게 말한 표현이에요.', ['류는 어디에 있나요?', '저는 괜찮아요.']),
  phrase('again', 'greetings', 'Say that again, please.', '다시 말해 주세요.', '상대의 말을 놓쳤을 때 천천히 다시 부탁해요.', 'Say로 시작하고, please로 부탁을 마무리해요.', ['잠시 기다려 주세요.', '이름을 알려 주세요.']),
  phrase('nice', 'greetings', 'Nice to meet you.', '만나서 반가워요.', '인사와 이름을 말한 뒤에 덧붙여요.', 'Nice to…로 시작해요.', ['내일 만나요.', '다시 말해 주세요.']),
  phrase('thanks', 'greetings', 'Thank you.', '감사합니다.', '도움을 받거나 물건을 건네받았을 때 말해요.', 'Thank로 시작해요.', ['미안합니다.', '안녕하세요.']),
  phrase('water', 'cafe', 'Water, please.', '물 주세요.', '카페나 식당에서 물을 부탁해요.', 'Water 다음에 부탁하는 말을 붙여요.', ['커피 주세요.', '물은 어디 있나요?']),
  phrase('coffee', 'cafe', 'Coffee, please.', '커피 주세요.', '메뉴를 가리키며 간단하게 주문해요.', 'Coffee 다음에 please를 붙여요.', ['물 주세요.', '커피가 맛있어요.']),
  phrase('price', 'shopping', 'How much is it?', '얼마인가요?', '물건이나 메뉴의 가격을 물어요.', 'How much…로 시작해요.', ['어디에 있나요?', '몇 시인가요?']),
  phrase('card', 'shopping', 'Can I pay by card?', '카드로 결제할 수 있나요?', '계산할 때 카드 결제가 가능한지 확인해요.', 'Can I…로 시작해요.', ['영수증을 받을 수 있나요?', '할인해 주실 수 있나요?']),
  phrase('restroom', 'directions', 'Where is the restroom?', '화장실은 어디에 있나요?', '가게나 역에서 화장실 위치를 물어요.', 'Where is…로 시작해요.', ['화장실이 가까운가요?', '화장실을 써도 되나요?']),
  phrase('near', 'directions', 'Is it near here?', '여기서 가까운가요?', '위치를 들은 뒤 거리를 간단히 확인해요.', 'Is it…으로 질문을 시작해요.', ['여기서 기다릴까요?', '여기가 맞나요?']),
  phrase('hungry', 'daily', "I'm hungry.", '배가 고파요.', '내 상태를 짧게 말해요.', '이름을 말할 때처럼 I’m으로 시작해요.', ['피곤해요.', '목이 말라요.']),
  phrase('break', 'daily', 'I need a break.', '잠깐 쉬어야겠어요.', '오래 걷거나 일하다가 쉬고 싶을 때 말해요.', 'I need…로 시작해요.', ['도움이 필요해요.', '배가 고파요.']),
  phrase('good', 'plans', 'That sounds good.', '좋은 생각이에요.', '상대의 제안이 마음에 들 때 답해요.', 'That sounds…로 시작해요.', ['잘 들리지 않아요.', '나중에 생각해 볼게요.']),
  phrase('tomorrow', 'plans', 'See you tomorrow.', '내일 만나요.', '내일 다시 만날 사람에게 작별 인사를 해요.', 'See you… 다음에 내일을 뜻하는 말을 붙여요.', ['만나서 반가워요.', '오늘 만나요.']),
]
export const phraseById = Object.fromEntries(phrases.map(p => [p.id, p]))
export const lessons: Lesson[] = [
  { id: 'day-1', version: 1, day: 1, title: '인사 한마디부터', goal: '인사하고, 이름을 말하고, 다시 부탁해요.', scene: '여행지에서 처음 만난 사람과 인사를 나눠요.', newPhraseIds: ['hello', 'name', 'again'], reusePhraseIds: [] },
  { id: 'day-2', version: 1, day: 2, title: '반가움과 고마움', goal: '만나서 반갑다고, 고맙다고 말해요.', scene: '어제 만난 사람에게 다시 인사해요.', newPhraseIds: ['nice', 'thanks'], reusePhraseIds: ['hello', 'name'] },
  { id: 'day-3', version: 1, day: 3, title: '카페에서 작은 주문', goal: '물이나 커피를 간단히 부탁해요.', scene: '카페에서 메뉴를 가리키며 주문해요.', newPhraseIds: ['water', 'coffee'], reusePhraseIds: ['thanks'] },
  { id: 'day-4', version: 1, day: 4, title: '가격을 묻고 계산하기', goal: '가격과 카드 결제 가능 여부를 물어요.', scene: '카페에서 주문한 커피 값을 계산해요.', newPhraseIds: ['price', 'card'], reusePhraseIds: ['coffee', 'thanks'] },
  { id: 'day-5', version: 1, day: 5, title: '필요한 곳 찾기', goal: '화장실 위치와 거리를 물어요.', scene: '산책하다가 가까운 화장실을 찾아요.', newPhraseIds: ['restroom', 'near'], reusePhraseIds: ['again'] },
  { id: 'day-6', version: 1, day: 6, title: '내 상태 말하기', goal: '배고픔과 쉬고 싶은 마음을 전해요.', scene: '함께 걷는 사람에게 잠깐 쉬자고 말해요.', newPhraseIds: ['hungry', 'break'], reusePhraseIds: ['water'] },
  { id: 'day-7', version: 1, day: 7, title: '다음 만남을 기약하기', goal: '제안에 답하고 내일 다시 만나기로 해요.', scene: '내일도 같이 커피를 마시자는 제안에 답해요.', newPhraseIds: ['good', 'tomorrow'], reusePhraseIds: ['nice', 'thanks'] },
]
export const modules: { id: ModuleId; title: string; next: string }[] = [
  { id: 'greetings', title: '인사', next: '도움을 부탁하고 대화를 시작하기' },
  { id: 'numbers', title: '숫자·시간·자기소개', next: '나이, 시간, 출신을 짧게 말하기' },
  { id: 'cafe', title: '카페 주문', next: '크기, 온도, 포장 여부 선택하기' },
  { id: 'daily', title: '일상', next: '하루 행동과 상태 전하기' },
  { id: 'hobbies', title: '취미', next: '좋아하는 활동 묻고 답하기' },
  { id: 'directions', title: '길 묻기', next: '방향을 듣고 다시 확인하기' },
  { id: 'shopping', title: '쇼핑', next: '크기와 색상 요청하기' },
  { id: 'plans', title: '약속', next: '날짜와 장소 정하기' },
]

export interface Word {
  id: string; version: 1; en: string; ko: string; choices: string[]
  explanation: string; examplePhraseId: string; audio: string
}
const word = (id: string, en: string, ko: string, wrong: string[], examplePhraseId: string, explanation: string): Word => ({
  id, version: 1, en, ko, choices: [ko, ...wrong], examplePhraseId, explanation, audio: `/audio/word-${id}.wav`,
})
// A small authored starting set, not a claim about an optimal daily quantity.
export const words: Word[] = [
  word('hello', 'hello', '안녕하세요', ['감사합니다', '내일'], 'hello', '처음 만났을 때 건네는 짧은 인사예요.'),
  word('again', 'again', '다시', ['가까이', '좋은'], 'again', '같은 일을 한 번 더 할 때 써요. 다시 말해 달라고 부탁할 때도 써요.'),
  word('please', 'please', '부탁해요', ['어디', '배고픈'], 'water', '부탁을 부드럽게 만드는 말이에요. 물을 뜻하는 water 뒤에 붙여 볼 거예요.'),
  word('nice', 'nice', '좋은', ['내일', '물'], 'nice', '만나서 좋다는 인사에서 nice를 써요. 문장 전체는 “만나서 반가워요”예요.'),
  word('thank', 'thank', '고마워하다', ['기다리다', '만나다'], 'thanks', 'Thank you.는 상대에게 고맙다고 말하는 표현이에요.'),
  word('water', 'water', '물', ['커피', '카드'], 'water', 'Water, please.처럼 물을 부탁하는 말에 써요.'),
  word('coffee', 'coffee', '커피', ['물', '휴식'], 'coffee', 'Coffee, please.처럼 커피를 주문할 때 써요.'),
  word('much', 'much', '많은', ['가까운', '배고픈'], 'price', 'How much는 양이나 가격을 묻는 덩어리예요. How much is it?은 “얼마인가요?”예요.'),
  word('card', 'card', '카드', ['화장실', '내일'], 'card', 'by card는 “카드로”라는 뜻이에요. 결제 방법을 말할 때 써요.'),
  word('where', 'where', '어디', ['다시', '많은'], 'restroom', '장소를 물을 때 문장 앞에 써요.'),
  word('restroom', 'restroom', '화장실', ['카페', '커피'], 'restroom', '가게나 역에서 찾는 화장실이에요.'),
  word('near', 'near', '가까이', ['다시', '내일'], 'near', 'Is it near here?에서 “여기서 가까운가요?”라고 확인해요.'),
  word('hungry', 'hungry', '배고픈', ['고마운', '좋은'], 'hungry', 'I’m hungry.처럼 내 상태를 말할 때 써요.'),
  word('break', 'break', '휴식', ['카드', '물'], 'break', '여기서는 쉬는 시간을 뜻해요. I need a break.로 잠깐 쉬고 싶다고 말해요.'),
  word('good', 'good', '좋은', ['많은', '배고픈'], 'good', 'That sounds good.는 상대의 제안이 좋아 보인다는 뜻이에요.'),
  word('tomorrow', 'tomorrow', '내일', ['다시', '어디'], 'tomorrow', 'See you tomorrow.처럼 다음에 만날 날을 말해요.'),
]
export const wordById = Object.fromEntries(words.map(w => [w.id, w]))
export const phraseWordIds: Record<string, string[]> = {
  hello: ['hello'], name: [], again: ['again', 'please'], nice: ['nice'], thanks: ['thank'],
  water: ['water', 'please'], coffee: ['coffee', 'please'], price: ['much'], card: ['card'],
  restroom: ['where', 'restroom'], near: ['near'], hungry: ['hungry'], break: ['break'], good: ['good'], tomorrow: ['tomorrow'],
}
export function matchesWord(input: string, word: Word): boolean {
  return input.trim().toLocaleLowerCase('en').replace(/[.!?,]+$/g, '') === word.en.toLowerCase()
}

export function shuffledIndices(length: number, seed: string): number[] {
  const ids = Array.from({ length }, (_, i) => i)
  let n = [...seed].reduce((a, c) => a + c.charCodeAt(0), 1)
  for (let i = length - 1; i > 0; i--) {
    n = (n * 1664525 + 1013904223) >>> 0
    const j = n % (i + 1)
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  if (length > 1 && ids.every((v, i) => v === i)) ids.push(ids.shift()!)
  return ids
}
