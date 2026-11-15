// служебные имена: нельзя назваться "Администратор", "Поддержка Dock", "Модератор" и т.п.
// имя видят другие участники сделки, и так можно выдать себя за сотрудника сервиса
//
// сравниваю не буквально, а по "скелету" слова, чтобы не обходили через:
// регистр, е/ё, цифры и значки вместо букв (adm1n, @dmin), русские буквы похожие на
// латинские (аdmin с русской а), точки/подчеркивания (ad_min, a.d.m.i.n), буквы через пробел

// основы слов - запрещены в любом месте слова (DockSupport, техподдержка, Админ777)
const RESERVED_STEMS = [
  // админы и модераторы
  'admin',
  'админ',
  'moderator',
  'модератор',
  'superuser',
  'суперюзер',
  'sysop',
  // поддержка
  'support',
  'саппорт',
  'сапорт',
  'поддержк',
  'helpdesk',
  'хелпдеск',
  // безопасность, арбитраж, гарант сделки
  'security',
  'безопасност',
  'arbitr',
  'арбитр',
  'garant',
  'гарант',
  'guarantor',
  'escrow',
  'эскроу',
  // "официальный представитель"
  'official',
  'официальн',
  'anonymous',
  'аноним',
];

// а эти только целым словом: внутри фамилий они встречаются (Murdock, Ботов)
const RESERVED_WORDS = [
  'dock',
  'док',
  'root',
  'system',
  'система',
  'bot',
  'бот',
  'robot',
  'робот',
  'service',
  'сервис',
  'служба',
  'staff',
  'team',
  'manager',
  'менеджер',
  'operator',
  'оператор',
  'dispatcher',
  'диспетчер',
  'null',
  'undefined',
  'test',
  'тест',
];

// цифры и значки, которыми заменяют буквы
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

// русские буквы, которые выглядят как латинские: аdmin с русской а, suррогt с русскими р
const LOOKALIKES: Record<string, string> = {
  а: 'a',
  в: 'b',
  е: 'e',
  к: 'k',
  м: 'm',
  н: 'h',
  о: 'o',
  р: 'p',
  с: 'c',
  т: 't',
  у: 'y',
  х: 'x',
};

// транслит - если слово набрано вперемешку двумя алфавитами (аdмин)
const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

// скелет слова: одинаковый для всех написаний, которые выглядят (LOOKALIKES) или читаются (TRANSLIT) одинаково
function skeleton(word: string, letters: Record<string, string>): string {
  return [...word.toLowerCase().replaceAll('ё', 'е')]
    .map((char) => LEET[char] ?? char)
    .filter((char) => /[\p{L}\p{N}]/u.test(char))
    .map((char) => letters[char] ?? char)
    .join('');
}

// запрещенные основы и слова сразу в обоих скелетах
const RULES = [LOOKALIKES, TRANSLIT].map((letters) => ({
  letters,
  stems: RESERVED_STEMS.map((stem) => skeleton(stem, letters)),
  words: new Set(RESERVED_WORDS.map((word) => skeleton(word, letters))),
}));

// разбивает имя на слова, буквы через пробел (a d m i n) склеивает в одно
function wordsOf(name: string): string[] {
  const words: string[] = [];
  let spelled = '';
  for (const part of name.split(/\s+/).filter(Boolean)) {
    if ([...part].length === 1) {
      spelled += part;
      continue;
    }
    if (spelled) words.push(spelled);
    spelled = '';
    words.push(part);
  }
  if (spelled) words.push(spelled);
  return words;
}

// true если имя похоже на сотрудника сервиса или служебную учетку
export function isReservedName(name: string): boolean {
  // NFKC превращает всякие широкие и стилизованные буквы в обычные, \p{Cf} - невидимые символы внутри слова
  const words = wordsOf(name.normalize('NFKC').replace(/\p{Cf}/gu, ''));
  return RULES.some(({ letters, stems, words: reserved }) =>
    words
      .map((word) => skeleton(word, letters))
      .some((word) => reserved.has(word) || stems.some((stem) => word.includes(stem))),
  );
}

export const RESERVED_NAME_MESSAGE = 'Это имя зарезервировано для сотрудников сервиса. Укажите свои имя и фамилию';
