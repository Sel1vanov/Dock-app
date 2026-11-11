/**
 * Служебные имена. Пользователь не может назваться «Администратор», «Поддержка Dock», «Модератор» и т. п.:
 * такое имя видят другие участники сделки, и им легко выдать себя за сотрудника сервиса.
 *
 * Имя сравнивается не буквально, а по «скелету»: регистр, ё/е, цифры и знаки вместо букв (adm1n, @dmin),
 * латинские и кириллические буквы-двойники (аdmin с русской «а»), точки и подчёркивания внутри слова
 * (ad_min, a.d.m.i.n) и буквы через пробел (a d m i n) обходом не считаются.
 */

/** Основы слов: запрещены в любом месте слова («DockSupport», «техподдержка», «Админ777»). */
const RESERVED_STEMS = [
  // администрация и модерация
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
  // безопасность, арбитраж, «гарант сделки»
  'security',
  'безопасност',
  'arbitr',
  'арбитр',
  'garant',
  'гарант',
  'guarantor',
  'escrow',
  'эскроу',
  // «официальный представитель»
  'official',
  'официальн',
  'anonymous',
  'аноним',
];

/** Слова целиком: как часть фамилии они встречаются (Murdock, Ботов), а отдельным словом — нет. */
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

/** Цифры и знаки, которыми заменяют буквы. */
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

/** Кириллические буквы, неотличимые на вид от латинских: «аdmin» с русской «а», «suррогt» с русскими «р». */
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

/** Транслитерация: слово, набранное вперемешку двумя алфавитами («аdмин»), читается так же. */
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

/** «Скелет» слова: одинаковый для всех написаний, которые выглядят (LOOKALIKES) или читаются (TRANSLIT) одинаково. */
function skeleton(word: string, letters: Record<string, string>): string {
  return [...word.toLowerCase().replaceAll('ё', 'е')]
    .map((char) => LEET[char] ?? char)
    .filter((char) => /[\p{L}\p{N}]/u.test(char))
    .map((char) => letters[char] ?? char)
    .join('');
}

/** Запрещённые основы и слова в обоих «скелетах». */
const RULES = [LOOKALIKES, TRANSLIT].map((letters) => ({
  letters,
  stems: RESERVED_STEMS.map((stem) => skeleton(stem, letters)),
  words: new Set(RESERVED_WORDS.map((word) => skeleton(word, letters))),
}));

/** Слова имени; буквы через пробел («a d m i n») склеиваются в одно слово. */
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

/** Имя выдаёт пользователя за сотрудника сервиса или служебную учётную запись. */
export function isReservedName(name: string): boolean {
  // NFKC приводит «широкие» и стилизованные буквы к обычным; \p{Cf} — невидимые символы внутри слова
  const words = wordsOf(name.normalize('NFKC').replace(/\p{Cf}/gu, ''));
  return RULES.some(({ letters, stems, words: reserved }) =>
    words
      .map((word) => skeleton(word, letters))
      .some((word) => reserved.has(word) || stems.some((stem) => word.includes(stem))),
  );
}

export const RESERVED_NAME_MESSAGE = 'Это имя зарезервировано для сотрудников сервиса. Укажите свои имя и фамилию';
