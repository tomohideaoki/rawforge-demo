# Global Parents：実HTMLの翻訳契約検証（2026-10-29）

## 実施範囲と成果物
- 基準：Draft PR #4（head `8e99bc973d720c5a593dcd6b87ac7c23a47bab7b`）と、2026-10-28の `prep/mock-worker-20261028`。
- 新規隔離ブランチ：`prep/frontend-worker-regression-20261029`。
- 新規テスト：`tests/translation-worker-contract.test.cjs`（7件）。現行 `index.html` のインラインJSと `experiments/translation-quota.mjs` を使い、HTTP/AIをモック化する。
- `GP_TRANSLATION_ENABLED=false`、本番Worker・main・既存Draft PR・公開サイト・Secret・SNS・決済は変更しない。

## 実際に実施したオフライン検証
1. **GitHubから取得した実 `index.html`（blob SHA `32b76ec09017a66303087f880a5d72743a71ebab`）のインラインスクリプトを隔離V8環境で実行**。31項目成功・失敗0。7種類の定型文、無効化、同意、1000文字、Unicode、HTTPエラー、異常レスポンス、サーバー側ゲートとのv2契約、429での英文保持等を確認。これは独自のV8検証であり、Nodeの既存テスト全体ではない。
2. 新規テストファイルをNode.js v22.16.0で構文チェック：成功。さらに **7件成功・失敗0**。ただしNodeテストの実行対象HTMLは、GitHub実ファイルではなく同じ翻訳ハンドラー部分を抜き出した**ローカル最小模擬HTML**。この制限を無視して「実HTMLのNode回帰テスト成功」とは言わない。
3. 新規テストのローカルファイルとGitHub保存後のblob SHAは一致（`93840da02a11918b3d5fd9276be950c076aff8bc`）。GitHubへの保存・再取得を確認。
4. 2026-10-29の新規GitHub Actionsは起動していない。読み取りで確認した直近のスケジュール実行は **2026-10-28 00:31:22 UTC / success / main**（https://github.com/tomohideaoki/rawforge-demo/actions/runs/40609290753）。**この成功は今回の隔離ブランチのテスト成功ではない**。

## 本番停止理由・重要な製品上の問題
- Worker本番ソース、Cloudflare本人アカウントの料金プラン・残量、Durable Objectsの本番配線、認証/Bot対策、AIモデルと出力トークン上限は未確認。モデル呼び出しは実施しない。
- 1日の回数制限はAI消費量・請求額の厳密な上限ではない。Cloudflare公式料金（2026-10-29確認）: https://developers.cloudflare.com/workers-ai/platform/pricing/ 、https://developers.cloudflare.com/durable-objects/platform/pricing/ 。Freeプランの無料枠とPaidプランの超過課金の違いを、本人契約で要確認。
- **対象ユーザーは英語が分からない日本人保護者なのに、現在のAI翻訳レスポンスは `english` だけで、対応する日本語の確認用訳がない**。英文の意味を自力で確認できないことは公開前の重大な製品リスク。日本語確認訳の提供方法と意味保持の評価が必要。
- `freeText` 以外の名前・日付・詳細等はAPIに送信されない。画面に入力した内容すべてが翻訳されたと誤認させないUIが必要。
- 既存テスト全体（`node --test tests/*.test.cjs`）をGitHub実HTMLを使ってNodeで再実行したわけではない。GitHub上の新テストも未実行。ローカルV8検証は実ブラウザ・Cloudflare・実AIの代替ではない。

## Plugins移行・需要検証
- 共通指示・参考資料分類・品質評価Q01〜Q12は既存 `docs/portable-school-workflow-v0.1.md` を再利用。今回重複作成なし。
- 既存カスタムGPTの指示・知識ファイル、学校独自資料は未取得。Plugin公式互換性、実装、動作検証、切替は未実施。
- 有料需要ヒアリング、外部送信、決済、売上検証は未実施。既存 `docs/translation-safety-and-demand-gates-20261026.md` の準備案を再利用。

## 次の作業
1. GitHubの実 `index.html` と全既存テストを同じNodeローカル環境で実行し、今回の新テストも含めて回帰確認（本番APIなし）。
2. 英語が分からない利用者の確認手段（忠実な和訳と意味の差分確認）を、Q01〜Q12で評価可能な契約へ整理。
3. 本番Workerと契約・課金上限・本人の利用可能プランを確認できるまで実AIと公開を停止。確認後も実行には別途本人承認が必要。

追加の有料API・課金操作なし。Cloudflare本人アカウントの実請求額は未確認。データ・メール・原本の削除なし。
