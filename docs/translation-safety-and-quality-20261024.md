# Global Parents：翻訳品質と費用停止ゲート（2026-10-24）
状態：**ローカルの準備・テストのみ**。本番API接続、Cloudflareへの配置、AI実行、課金、Plugin移行は行っていない。

## 今回追加した動く成果物
- `tools/usage-gate.cjs`：AI呼び出し前に入力長・本人識別子・UTC日付・日次総量・利用者別総量を検査する純粋なゲート。初期値は**無効**。原文を保存しない。永続的な台帳がない場合は拒否。
- `tools/usage-gate.test.cjs`：無効状態、誤設定、入力境界、認証識別子不備、台帳障害、利用者別/全体上限、UTC日付切替、同時100件、失敗した呼び出しの予約維持を検査。
- `tools/quality-review-sheet.cjs` と同テスト：既存の `docs/portable-school-workflow-v0.1.md` の12件を重複記述せず読み、評価者が入力/出力/重大な誤り/合否を記録できるCSVを生成。
- `docs/evaluation/quality-review-template-20261024.csv`：既存のQ01〜Q12から生成したレビューシート。**観測出力と合否は空欄**。AIの品質評価が合格したとは報告しない。

ローカル実行コマンド（Node.js標準機能のみ）：
```sh
node --test tools/usage-gate.test.cjs tools/quality-review-sheet.test.cjs
node tools/quality-review-sheet.cjs docs/portable-school-workflow-v0.1.md > quality-review-local.csv
```
確認実績：隔離したローカル環境でテスト14件成功、失敗0件。元資料のQ01〜Q12を抽出したCSVは12行、重複なし、判定欄12件すべて空欄。GitHub Actions実行は行っていない。

## 本番公開を止める理由（重要）
1. `MemoryLedger` は単一プロセスのテスト用。Cloudflareの複数インスタンス間で上限を保証できない。**本番では使用禁止**。グローバルと利用者別のカウントを**同一原子的操作**で予約する永続ストアが必要。
2. `actorId` はログイン等でサーバーが検証したIDのみ許可。リクエスト本文や未検証ヘッダーをそのままIDとして渡すと制限回避が可能。現行サイトは認証機構が未確認。
3. 日次「回数」上限だけではAI推論量や請求金額を保証しない。入力トークン・出力トークン・モデル単価・プロバイダーの**支出上限/Freeプランの超過拒否**を別途確認する。呼び出し前に予約し、通信失敗でも枠を戻さない。
4. CloudflareのRate Limiting bindingは拠点ごとに概算・結果整合性が遅れるため、厳密な**全世界共通の予算台帳の代わりにはならない**。
5. Workers AIの公式料金表（2026-10-01更新）ではFreeプランに1日10,000 Neuronsの無料枠があり、Freeでは上限超過の操作が失敗する。ただし本人の実際のプラン、使用モデル、他用途の消費量、Workerの構成は未確認。Paidなら超過課金の可能性がある。
6. Durable ObjectsはWorkers FreeでSQLiteバックエンドを利用可能とされるが、導入・バインディング設定は**外部サービス変更**であり未実施。現在のアカウント条件・実装方式の検証が必要。
7. 児童・学校に関する入力の取り扱い、保存有無、利用規約・プライバシー案内、API契約・CORS・ブラウザ動作は未確認。

公式根拠（確認日 2026-10-24）：
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

## 移植資産の整理状況
- 役割・対象・手順・出力順・禁止事項：既存 `docs/portable-school-workflow-v0.1.md` を正本として再利用。
- 出典・版：同資料に `index.html` と `docs/translation-connection.md` の基準コミットを記録済み。今回のゲートは別ファイルで版管理。
- 品質評価：同資料の12件をCSVに変換。意味保持・否定・時刻・事実追加・指示注入の失敗は重大。人間または承認済みモデルで実際の出力を採点するまでは**未評価**。
- 外部接続：Webは `POST {text} -> {english}`、Pluginの実装方式・権限・互換性は未確認。既存カスタムGPTの指示・知識ファイル、学校固有の非公開資料は**未取得**。推測で復元せず公開GitHubに保存しない。

## 収益化へ進むための次の優先作業
- 実費ゼロのまま：APIレスポンスの不足（和訳、注意点等）を仕様と評価で切り分け、架空のケースを使ったオフライン動作確認を増やす。
- 実サービス導入前：無料枠の適用条件、厳密な原子的台帳、本人認証、モデル最大トークン、プライバシー方針を検証する。これらが揃うまで翻訳機能のフラグを有効にしない。
- 有料需要の確認：価格を先に確定させず、利用者が「文章コピー方式」と「サイト内で完結する翻訳」にどの程度価値を感じるかを、**公開前のオフライン質問票**で比較する。実際の配布・連絡・販売・決済は未実施。

費用：今回のローカルテストとGitHubの文書・コード作成で追加料金の発生は確認していない。GitHub Actions・AI APIは実行していない。main、既存PR、公開サイト、Cloudflare、SNS、権限/Secret、外部アカウントには変更なし。

## 追加：有料需要を調べるための非公開試作品
- `prototypes/paid-demand-preview-20261024.html`：無料テンプレート方式（A）と、未提供のサイト内英訳・和訳方式（B）を比較する5問の質問票。氏名・学校名・児童情報・メールアドレスの入力欄は設けない。
- 回答はブラウザから**端末内のCSVへ保存**するのみ。フォーム送信先、外部スクリプト、外部通信API、決済、申し込み受付はない。
- ローカル静的検査：質問カテゴリ5つ、外部script/src/actionなし、fetch/XMLHttpRequest/sendBeaconなしを確認。**実ブラウザでの利用者テスト、配布、回答回収は未実施**。
- 「支払ってもよい」というアンケート回答だけでは売上の証拠にならない。実際の申込・決済の需要検証は、適法な公開方法と承認を得てから別途実施。
