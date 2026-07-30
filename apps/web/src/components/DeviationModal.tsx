import { useState } from "react";

type DeviationModalProps = {
  onSubmit: (result: { focused: boolean; reason: string | undefined }) => void;
  onCancel: () => void;
};

/**
 * 計画時間と実績の乖離が10分以上のときに、終了前に挟む確認モーダル。
 * 「集中できたか」を選ぶまでは終了を確定させない（振り返りを飛ばせないようにするため）。
 */
export function DeviationModal({ onSubmit, onCancel }: DeviationModalProps) {
  const [focused, setFocused] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");

  const canSubmit = focused !== null;

  const handleSubmit = () => {
    if (focused === null) return;
    const trimmedReason = reason.trim();
    onSubmit({ focused, reason: trimmedReason === "" ? undefined : trimmedReason });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 flex items-center justify-center bg-black/40 px-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-bold text-gray-900">予定時間と差がありました</h2>
        <p className="mt-1 text-sm text-gray-600">集中できましたか？</p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setFocused(true)}
            className={`min-h-11 flex-1 rounded-md border px-4 text-sm font-medium ${
              focused === true
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 bg-white text-gray-700"
            }`}
          >
            はい
          </button>
          <button
            type="button"
            onClick={() => setFocused(false)}
            className={`min-h-11 flex-1 rounded-md border px-4 text-sm font-medium ${
              focused === false
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 bg-white text-gray-700"
            }`}
          >
            いいえ
          </button>
        </div>

        <label className="mt-4 block text-sm text-gray-700">
          理由（任意）
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 px-4 text-sm text-gray-600 hover:text-gray-900"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="min-h-11 rounded-md bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            終了する
          </button>
        </div>
      </div>
    </div>
  );
}
