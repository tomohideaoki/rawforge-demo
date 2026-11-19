# 2026-10-27｜Global Parents 翻訳接続と利用制限の実装・検証記録

対象: Draft PR #4 (head 8e99bc973d720c5a593dcd6b87ac7c23a47bab7b) と既存の `prep/portable-workflow-20261023`。**PR #4自体は変更せず**、そのheadから作成した別ブランチ `prep/pr4-quota-contract-20261027` のみ変更。

## 今回のコード成果物
- `index.html`: 送信契約を `{text,consent:true}` に修正。翻訳は `GP_TRANSLATION_ENABLED=false` のまま。Unicode文字数をサーバーと同じコードポイント基準に統一。
- `tests/translation.test.cjs`: 上記契約と補助文字600個の入力を検証するテストに修正（**この既存テスト全体のローカル実行は未実施**）。
- `experiments/translation-quota.mjs`: 前回作成済みの拒否優先ゲートを隔離ブランチへ再利用。新規の本番接続ではない。
- `tests/translation-contract.test.cjs`: v1拒否、v2同意、無効化、ストレージ未接続、上限を確認。
- `experiments/sqlite-reservation.mjs`: SQLiteの単一UPSERT/RETURNINGで原子的に日次回数を予約するオフライン試作。**Cloudflare Durable Objectへの配線・実機検証なし**。
- `tests/sqlite-reservation.test.cjs`: SQLite実データベース（ローカルのメモリーDB）で日次上限、50件の並列要求、別アダプター共有、日付更新、異常入力、ゲート連携を検証。

## 検証結果と限界
- ローカル Node.js v22.16.0、`node --test tests/translation-contract.test.cjs tests/sqlite-reservation.test.cjs`：**12件成功 / 失敗0件**。Node標準の `node:sqlite`（実験的API）を使用。追加パッケージなし。
- **重要な制限**：ローカルのHTMLは契約部分だけの最小模擬ファイル。GitHub上の実 `index.html` と既存の `translation.test.cjs` の**全体を実行した結果ではない**。実ファイルに対しては、GitHubから再取得し、無効フラグ・送信契約・Unicode制限・テスト期待値の文字列整合を確認した。
- GitHub Actionsの新規実行、Cloudflare Workers/AI/Durable Objectsへの通信、モデルの品質評価、課金、公開は**実施なし**。
- 現行本番Workerのコード、本人のCloudflareプラン・利用残量、Durable Object利用可否、認証・Bot対策は未確認。SQLite上限はリクエスト回数の制限であり、Neurons消費量の厳密な予算保証ではない。
- `consent:true` はクライアントの申告であり本人確認ではない。利用者単位の不正利用防止・個人情報保護の代替にはならない。学校・児童の実データは使用していない。

## 外部仕様の確認（2026-10-27）
- Workers AI料金: https://developers.cloudflare.com/workers-ai/platform/pricing/ （Workers Freeは日次10,000 Neuronsの無料割当、Paidでは超過課金の可能性）
- Durable Objects料金: https://developers.cloudflare.com/durable-objects/platform/pricing/ （FreeプランでもSQLite-backedを利用できるが別枠の上限がある）
- SQLiteストレージAPI: https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/ （`sql.exec` と原子的な保存操作）
実際のアカウントのプランは未確認。無料と確認できない本番操作は停止する。

## 品質評価・Plugins移行・収益化
- 意味品質ケースQ01〜Q12と合否基準は `docs/portable-school-workflow-v0.1.md` に既存。重複作成なし。**実モデル評価は未実施**。
- 移植可能な指示・資料分類・接続仕様の原案は既存資料を再利用。Library検索で過去のHTML試作品は見つかったが、既存カスタムGPTの設定・知識ファイルは見つからず未取得。Plugin公式互換性・本人アカウントでの動作は未検証、切替なし。
- 有料需要ヒアリング案は `docs/translation-safety-and-demand-gates-20261026.md` を再利用。実利用者への聞き取り・販売・決済は未実施。

## 次の実装と停止理由
1. 本番Workerのコード・Cloudflareプラン・AIモデルと出力上限・無料枠残量・Durable Object設定を取得し、課金条件を確認。**取得まで本番接続を停止**。
2. 本番AIを使わないWorker模擬ハンドラーを作り、SQL予約→拒否→エラー処理をオフライン検証。
3. GitHub実HTMLを含む既存回帰テスト全体をローカルで実行できる環境を整え、成功を確認してから公開を検討。
4. 保護者への需要検証は同意・プライバシー条件を整えた後に実施。実際の需要や売上は未確認。

費用：この実行で有料API・有料サービス・課金操作は行っていない。請求画面での残高・利用額の検証は未実施。
変更範囲：隔離ブランチのみ。main、PR #2〜#4、Cloudflare、公開サイト、SNS、権限・Secret、メール・ファイル削除は変更なし。
