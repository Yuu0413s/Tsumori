import { useState } from "react";
import { canModifyCategory } from "@tsumori/core";
import { signOut } from "../lib/auth-client.js";
import { useMe } from "../hooks/use-me.js";
import { useSettings, useUpdateSettings, type UserSettings } from "../hooks/use-settings.js";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useHideCategory,
  type Category,
} from "../hooks/use-categories.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { LoadingScreen } from "../components/LoadingScreen.js";
import { formatApiError } from "../lib/format-error.js";

const PRE_ALARM_OPTIONS = [
  { value: "", label: "なし" },
  { value: "5", label: "5分前" },
  { value: "10", label: "10分前" },
];

function toggleButtonClassName(active: boolean): string {
  return `min-h-11 flex-1 rounded-md border px-4 text-sm font-medium ${
    active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-700"
  }`;
}

export function SettingsPage() {
  const meQuery = useMe();
  const settingsQuery = useSettings();
  const categoriesQuery = useCategories();

  // 3つのクエリを個別にガードする（結合した真偽値/エラーで判定すると、TypeScriptが
  // 各クエリの data の undefined 除去を追跡できなくなるため）。
  if (meQuery.isPending) {
    return <LoadingScreen />;
  }
  if (meQuery.error) {
    return <ErrorMessage message={formatApiError(meQuery.error)} />;
  }
  if (settingsQuery.isPending) {
    return <LoadingScreen />;
  }
  if (settingsQuery.error) {
    return <ErrorMessage message={formatApiError(settingsQuery.error)} />;
  }
  if (categoriesQuery.isPending) {
    return <LoadingScreen />;
  }
  if (categoriesQuery.error) {
    return <ErrorMessage message={formatApiError(categoriesQuery.error)} />;
  }

  return (
    <SettingsContent
      currentUserId={meQuery.data.userId}
      settings={settingsQuery.data}
      categories={categoriesQuery.data}
    />
  );
}

function SettingsContent({
  currentUserId,
  settings,
  categories,
}: {
  currentUserId: string;
  settings: UserSettings;
  categories: Category[];
}) {
  const updateSettings = useUpdateSettings();

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-8">
      <header>
        <h1 className="text-lg font-bold text-gray-900">設定</h1>
      </header>

      {updateSettings.error ? (
        <ErrorMessage message={formatApiError(updateSettings.error)} />
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-gray-900">休憩したら締切を延ばす</h2>
        <p className="text-xs text-gray-500">
          延ばす → 実作業時間が計画時間に達したらアラームが鳴ります。
          <br />
          延ばさない → 開始からの経過時間が計画時間に達したらアラームが鳴ります。
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={settings.breakExtendsDeadline}
            disabled={updateSettings.isPending}
            onClick={() => updateSettings.mutate({ breakExtendsDeadline: true })}
            className={toggleButtonClassName(settings.breakExtendsDeadline)}
          >
            延ばす
          </button>
          <button
            type="button"
            aria-pressed={!settings.breakExtendsDeadline}
            disabled={updateSettings.isPending}
            onClick={() => updateSettings.mutate({ breakExtendsDeadline: false })}
            className={toggleButtonClassName(!settings.breakExtendsDeadline)}
          >
            延ばさない
          </button>
        </div>
        <p className="text-xs text-amber-600">
          ⚠️ この設定を変更しても、進行中の記録には反映されません。
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-gray-900">アラーム音</h2>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={settings.soundEnabled}
            disabled={updateSettings.isPending}
            onClick={() => updateSettings.mutate({ soundEnabled: true })}
            className={toggleButtonClassName(settings.soundEnabled)}
          >
            ON
          </button>
          <button
            type="button"
            aria-pressed={!settings.soundEnabled}
            disabled={updateSettings.isPending}
            onClick={() => updateSettings.mutate({ soundEnabled: false })}
            className={toggleButtonClassName(!settings.soundEnabled)}
          >
            OFF
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <label className="flex flex-col gap-1" htmlFor="pre-alarm-minutes">
          <span className="text-sm font-bold text-gray-900">何分前に予告するか</span>
          <select
            id="pre-alarm-minutes"
            value={settings.preAlarmMinutes === null ? "" : String(settings.preAlarmMinutes)}
            disabled={updateSettings.isPending}
            onChange={(e) =>
              updateSettings.mutate({
                preAlarmMinutes: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="min-h-11 rounded-md border border-gray-300 px-3 text-base text-gray-900"
          >
            {PRE_ALARM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <CategorySection currentUserId={currentUserId} categories={categories} />

      <section>
        <button
          type="button"
          onClick={() => void signOut().catch((error: unknown) => console.error(error))}
          className="min-h-11 w-full rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ログアウト
        </button>
      </section>
    </div>
  );
}

function CategorySection({
  currentUserId,
  categories,
}: {
  currentUserId: string;
  categories: Category[];
}) {
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const hideCategory = useHideCategory();
  // いずれかの操作中は他のカテゴリ操作もまとめて無効化する（TimerPageと同じ狙い。
  // 同時編集による409/404を防ぐため）。
  const isMutating = createCategory.isPending || updateCategory.isPending || hideCategory.isPending;

  const mutationError =
    createCategory.error ?? updateCategory.error ?? hideCategory.error ?? undefined;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-gray-900">カテゴリ</h2>

      {mutationError ? <ErrorMessage message={formatApiError(mutationError)} /> : null}

      <ul className="flex flex-col gap-2">
        {categories.map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            // 共通カテゴリ（userId=null）は誰も編集・非表示できない
            // （apps/api/src/routes/categories.ts の canModifyCategory と同じ判定）。
            canModify={canModifyCategory(category.userId, currentUserId)}
            isMutating={isMutating}
            // 失敗時（例: 名前が100文字超でサーバーが400を返す）にも編集画面を
            // 閉じてしまうと、ユーザーが入力し直した内容が消えてしまう。
            // 成功したときだけ呼ばれる onSuccess を渡し、閉じるかどうかは
            // CategoryRow 側の責務にする。
            onUpdate={(patch, onSuccess) =>
              updateCategory.mutate({ id: category.id, ...patch }, { onSuccess })
            }
            onHide={() => hideCategory.mutate(category.id)}
          />
        ))}
      </ul>

      <AddCategoryForm
        isMutating={isMutating}
        onCreate={(input, onSuccess) => createCategory.mutate(input, { onSuccess })}
      />
    </section>
  );
}

function CategoryRow({
  category,
  canModify,
  isMutating,
  onUpdate,
  onHide,
}: {
  category: Category;
  canModify: boolean;
  isMutating: boolean;
  onUpdate: (patch: { name?: string; color?: string }, onSuccess: () => void) => void;
  onHide: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);

  if (isEditing) {
    return (
      <li className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          disabled={isMutating}
          aria-label={`${category.name}の色`}
          className="h-9 w-9 shrink-0 rounded"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isMutating}
          maxLength={100}
          aria-label={`${category.name}の名前`}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-gray-300 px-3 text-base text-gray-900"
        />
        <button
          type="button"
          disabled={isMutating || name.trim() === ""}
          onClick={() => {
            // 保存の成否に関わらず即座に編集画面を閉じると、失敗時（サーバー側の
            // バリデーションエラー等）に入力内容ごと消えてしまう。成功したときだけ
            // 閉じるようにする（キャンセル操作以外で入力が消えるのを防ぐ）。
            onUpdate({ name: name.trim(), color }, () => setIsEditing(false));
          }}
          className="min-h-11 shrink-0 rounded-md bg-gray-900 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          保存
        </button>
        <button
          type="button"
          disabled={isMutating}
          onClick={() => {
            setName(category.name);
            setColor(category.color);
            setIsEditing(false);
          }}
          className="min-h-11 shrink-0 px-2 text-sm text-gray-600"
        >
          キャンセル
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-2">
      <span className="flex items-center gap-2 text-sm text-gray-900">
        <span
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: category.color }}
        />
        {category.name}
      </span>
      {canModify ? (
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={isMutating}
            onClick={() => setIsEditing(true)}
            className="min-h-11 px-2 text-sm text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            編集
          </button>
          <button
            type="button"
            disabled={isMutating}
            onClick={onHide}
            className="min-h-11 px-2 text-sm text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            非表示
          </button>
        </div>
      ) : null}
    </li>
  );
}

function AddCategoryForm({
  isMutating,
  onCreate,
}: {
  isMutating: boolean;
  onCreate: (input: { name: string; color: string }, onSuccess: () => void) => void;
}) {
  const DEFAULT_COLOR = "#3b82f6";
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim() === "" || isMutating) return;
        // 追加の成否に関わらず即座にフォームをクリアすると、失敗時
        // （名前が100文字超でサーバーが400を返す等）に入力内容が消えてしまう。
        // 成功したときだけクリアする。
        onCreate({ name: name.trim(), color }, () => {
          setName("");
          setColor(DEFAULT_COLOR);
        });
      }}
      className="flex items-center gap-2"
    >
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        disabled={isMutating}
        aria-label="新しいカテゴリの色"
        className="h-9 w-9 shrink-0 rounded"
      />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={isMutating}
        maxLength={100}
        placeholder="新しいカテゴリ名"
        aria-label="新しいカテゴリ名"
        className="min-h-11 min-w-0 flex-1 rounded-md border border-gray-300 px-3 text-base text-gray-900"
      />
      <button
        type="submit"
        disabled={isMutating || name.trim() === ""}
        className="min-h-11 shrink-0 rounded-md bg-gray-900 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        追加
      </button>
    </form>
  );
}
