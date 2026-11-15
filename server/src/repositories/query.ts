// шаблон для ILIKE: спецсимволы LIKE из ввода юзера экранируются,
// а сама строка идет в запрос параметром ($1), с sql не склеивается
export function likePattern(input: string): string {
  return `%${input.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}
