import { eq, and, or, isNull } from "drizzle-orm";
import { categories, type Category, type NewCategory } from "./schema.js";
import type { Database } from "./index.js";

export interface CategoryStore {
  listVisible(userId: string): Promise<Category[]>;
  findById(id: string): Promise<Category | undefined>;
  insert(row: NewCategory): Promise<Category>;
  update(id: string, patch: Partial<Pick<NewCategory, "name" | "color">>): Promise<Category>;
  softDelete(id: string): Promise<Category>;
}

/**
 * ユーザー自身のカテゴリ + 共通カテゴリ（userId が null）のうち、
 * 論理削除されていないもの（isActive = true）だけを返す（Issue #8）。
 */
export function createCategoryStore(db: Database): CategoryStore {
  return {
    async listVisible(userId) {
      return db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.isActive, true),
            or(eq(categories.userId, userId), isNull(categories.userId)),
          ),
        );
    },

    async findById(id) {
      const [row] = await db.select().from(categories).where(eq(categories.id, id));
      return row;
    },

    async insert(row) {
      const [created] = await db.insert(categories).values(row).returning();
      if (!created) throw new Error("カテゴリの作成に失敗しました");
      return created;
    },

    async update(id, patch) {
      const [updated] = await db
        .update(categories)
        .set(patch)
        .where(eq(categories.id, id))
        .returning();
      if (!updated) throw new Error("カテゴリの更新に失敗しました");
      return updated;
    },

    // 物理削除しない。time_entries.categoryId が cascade ではないため、
    // 参照されているカテゴリを消すと外部キー違反になる（Issue #8）。
    async softDelete(id) {
      const [updated] = await db
        .update(categories)
        .set({ isActive: false })
        .where(eq(categories.id, id))
        .returning();
      if (!updated) throw new Error("カテゴリの削除に失敗しました");
      return updated;
    },
  };
}
