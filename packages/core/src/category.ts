const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const MAX_NAME_LENGTH = 100;

/**
 * カテゴリ名として有効か判定する。
 * 空文字・空白のみ・上限超過を弾く（Issue #8）。
 */
export function isValidCategoryName(name: unknown): name is string {
  return typeof name === "string" && name.trim().length > 0 && name.length <= MAX_NAME_LENGTH;
}

/**
 * カテゴリ色として有効か判定する。`#RRGGBB` 形式のみ許可する。
 */
export function isValidCategoryColor(color: unknown): color is string {
  return typeof color === "string" && COLOR_PATTERN.test(color);
}

/**
 * カテゴリを更新・削除してよいか判定する。
 * `userId` が null の共通カテゴリは、一般ユーザーからは常に編集不可（Issue #8）。
 */
export function canModifyCategory(categoryUserId: string | null, currentUserId: string): boolean {
  return categoryUserId !== null && categoryUserId === currentUserId;
}
