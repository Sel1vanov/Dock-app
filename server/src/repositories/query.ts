/**
 * Безопасный шаблон для ILIKE: спецсимволы LIKE во вводе пользователя экранируются,
 * а сама строка передаётся в запрос параметром ($1), а не склеивается с SQL.
 */
export function likePattern(input: string): string {
  return `%${input.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}
