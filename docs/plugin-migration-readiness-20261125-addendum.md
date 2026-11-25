# Global Parents｜2026-11-25 追加確認

- 対象ブランチ：`fix/global-parents-retention-plugin-20261125`
- 目的：11/24資料を重複作成せず、公開前に必要な費用境界・データ保持・Plugin移行期限の差分だけを補う。
- 状態：設計・オフライン実装の追加のみ。Cloudflare設定、本番Worker、AI Gateway、Custom GPT、Plugin、決済は操作していない。
- 確認日：2026-11-25（公式仕様は実装日に再確認する）。

## 1. 重要な結論

1. Draft PR #4は現在もDraft。旧契約は `POST {text} → {english}`。後続のオフラインv2は `POST {text, consent:true} → {english}` だが、本番Workerのコード・CORS・認証・レスポンスは未取得。どちらが本番仕様か推測しない。
2. 現行契約は英文のみ。英語が分からない保護者に必要な「実際の英文から作る確認用和訳」は未提供。Premiumの翻訳・課金を有効にしない。
3. 11/24の予算台帳に日次記録の保持期間がなかった。今回、既定1日（設定可能1〜30日）の古い日次行整理を追加した。削除はCloudflare SQLiteのrow writesに数えられるため、保持期間を短くすれば常にコストが下がるとは限らない。実際のユニーク利用者数と無料枠の範囲を見てから確定する。
4. Workers/DOのアカウントSpend LimitはAI推論費用を含む完全な請求上限ではない。Workers AIまたはAI Gatewayの個別予算と、アプリ内の原子的な予算ゲートを別々に設ける。
5. Custom GPTの標準廃止日は2026-12-11。今日（11/25）から16日。移行機能はアカウント/ワークスペースごとに異なり、本人の画面は未確認。原本保存を優先する。

## 2. Cloudflare費用制御（2026-11-25公式資料確認）

### Workers AI

- Workers Freeの無料割当は1日10,000 Neurons。日次リセットは00:00 UTC。
- Freeでは割当を超えた後の操作がエラーになる。10,000 Neurons/日を超える利用にはWorkers Paidが必要で、Paidでは無料割当を超えた分が$0.011 / 1,000 Neurons。
- 一部モデルは有料billing methodが必要。モデルごとにNeurons単価が異なる。
- したがって「1回の翻訳＝固定Neurons」と仮定しない。モデルID・最大入力・最大出力・システム指示を確定し、各モデルの入力/出力単価から保守的な最大値を算定できない場合は呼び出し拒否とする。

### SQLite-backed Durable Objects

Workers Freeで確認できる日次/総量枠の例：
- Requests：100,000 / day
- Duration：13,000 GB-s / day
- SQLite row reads：5 million / day
- SQLite row writes：100,000 / day
- SQLite stored data：5 GB（アカウント総量）

Free枠のいずれかを超えた種類の操作はエラーになり、直ちに有料超過に切り替わるわけではない。Paidでは含有枠を超えた利用や保存データに課金が発生し得る。

**重要：SQLiteのDELETEはrow writesとして計上される。** 今回加えた日次cleanupは、期限切れのglobal/user行を新UTC日の最初の予約処理時に削除する。これによりデータ保持期間は制限できるが、削除対象件数が書込枠を消費する。予算計算では予約INSERTだけでなくDELETE分も見込む。

### Spend LimitsとAI Gateway

- WorkersのSpend Limitはアカウント内のWorkers全体のリクエスト・CPU利用を対象にする。Durable ObjectsやWorkers AI推論は含まれない。
- Durable ObjectsのSpend Limitはアカウント内のDO利用を対象にし、リクエスト・duration・SQLite row read/write等を含むが、保存データ費用とWorkers Paidの共有月額料金は除外される。
- どちらも使用量の反映・遮断に遅延があり、処理中の利用や除外費用もあるため、請求額の完全な上限を保証しない。さらにアカウント全体のサービス停止を引き起こす可能性があるため、Global Parents単独の上限として本人の承認なしに設定してはならない。
- AI GatewayのSpend Limitは、Gatewayを通過するAIリクエストを利用者・モデル・プロバイダー等で区切って予算化し、上限後は429で遮断できる。ただし費用計測はトークン量とモデル価格に基づくbest-effort推定であり、正確な請求上限ではない。利用者別IDはサーバーで認証した値またはCloudflare Accessの認証メタデータを使い、ブラウザ入力のuserIdを信用しない。Gatewayを利用する場合もアプリ内の原子的ゲートを主制御とする。
- 今回は本人アカウントのプラン、AI Gateway利用可否、残量、課金設定を確認しておらず、Dashboard設定・Secret・Binding・Billing設定は一切変更していない。

### 推奨する重層構成

1. サーバー認証で本人を識別し、クライアントのplan/userIdを認証根拠にしない。
2. アプリ側のSQLite-backed Durable Objectで、全体とユーザー別の回数/Neuronsを同一同期トランザクションで予約。予約・保存・モデル単価設定のどれかが不明ならfail-closed。
3. 固定モデル・入力上限・出力上限から最大Neuronsを算出。実消費量が予約を超えないパラメータで呼び、二重送信は同一冪等キーで重複課金/消費を防ぐ。
4. 任意の二次防御としてAI Gatewayのモデル別/ユーザー別予算を検討。ただし適用範囲・利用可能プラン・見積り精度を実装時に確認。
5. Workers/DOのSpend Limitは、他の同一アカウントのアプリにも影響し、AI推論/DO保存データの一部を除外する。補助的な停止手段にとどめ、Global Parentsのみの厳密な上限として扱わない。
6. 管理ダッシュボードの使用量と請求書を照合する。アプリの見積りカウンターを請求書の代わりにしない。

## 3. 今回のオフラインコード変更

`experiments/sqlite-budget-ledger.mjs`：
- `retentionDays`（既定1、1〜30日）を追加。
- UTC日が変わった最初の予約処理内で、期限切れのglobal/user日次カウンター行を削除。
- cleanup状態も1行で保持し、同じ日に毎回DELETEしない。
- HMAC digestはサーバーだけで生成する前提を維持。テストのSHA-256は合成IDのローカル用で、本番HMACの代わりではない。
- 削除はSQLite row writesに数えられる点をコードコメントにも明記。

`tests/sqlite-budget-ledger.test.mjs`：
- UTC日切替後に期限切れ行が除去されること。
- retentionDays=3では直近3日だけ残ること。
- 0日・31日など不正保持期間を拒否すること。
- 既存のUTC切替テストも保持仕様に合わせて更新。

検証：Node.js v22.16.0、インメモリSQLite（`node:sqlite`実験的API）で `node --test tests/sqlite-budget-ledger.test.mjs tests/launch-gated-translation.test.mjs`。26 pass / 0 fail。これはNodeローカルの模擬SQLiteテストであり、Cloudflare Durable Objects実機・本番AI・請求/無料枠の検証ではない。

未実装：冪等キー、本人認証、HMAC実装と鍵保管、モデル単価/最大Neurons計算、Cloudflare adapter、実Workerとの契約整合、実機負荷、AI Gateway設定。重複リクエストは別予約として数えるため予算超過防止側には安全だが、再送でユーザー枠を余計に消費する可能性がある。

## 4. Draft PR #4との差分・公開条件

Draft PR #4（`feat/translation-connection-offline-20261019` → `main`）は引き続きDraft・未マージ。変更ファイルは `docs/translation-connection.md`、`index.html`、`tests/translation.test.cjs`。
- PR #4のv1は同意フィールドなし。
- その後のv2 mock contractは `consent:true` を必須とする。
- 本番Workerのソースコード、CORS、利用制限、認証、実応答は未確認。
- 現行応答は `english` のみ。確認用和訳のフィールドがない。
- PR #4に書かれた旧テスト数は、今回のブランチの現在のCI結果を示さない。今回のブランチのGitHub Actionsはまだ実行していない。
- よってPR #4をそのまま有効化・公開するのは不可。公開前に本番契約の取得と、英文＋確認用和訳の新しい応答契約、同意、認証、原子的な利用枠を一つのWorkerで統合してモック回帰を行う。

## 5. Custom GPT → Plugin移行の期限と失われるもの

2026-11-25にOpenAI公式FAQを再確認：
- 標準廃止日は2026-12-11（本日から16日）。一部の条件を満たすEnterprise/FedRAMPワークスペースだけ2027-02-28の別日程。本人のアカウント/ワークスペース通知を優先。
- 移行の表示・利用可否はアカウント/ワークスペースごとに異なり、全員に同時提供ではない。
- 移行対象は最新の公開済み版。Draft/未公開編集は移行されない。公開は一般公開を意味せず、リンク共有なしでの公開済み版保存が可能な場合がある。
- InstructionsはSkill、Knowledgeはreference files、Connected AppsはAppsへ引き継ぐ。Custom Actionsは自動移行されず、別途アプリまたはMCP等の接続再構築とテストが必要。選択モデルも引き継がれない。
- 個人移行のPluginは最初Private。既存GPTユーザーに自動配布されない。
- 移行後、元GPTは読み取り専用。標準廃止日にGPTとGPTページはアクセス不可になる。会話履歴は引き続きアクセスできる。
- personal ChatGPT Free/Go/Plus/Proでは新規GPT作成・公開不可。既存GPTはプラン/権限条件により編集可能。移行可否とは別なので、本人の画面で確認する。

## 6. Plugin資産準備の扱い

既存の共通ソースを重複コピーせず参照するマニフェストを `plugins/global-parents/README.md` に追加。
- 指示ソース：`docs/portable-school-workflow-v0.1.md` セクション1。
- Reference候補：同文書セクション2、`docs/translation-connection.md`、本資料、既存20例文商品原稿（別ブランチ）。
- 評価：Q01〜Q12は既存共通文書、Q13〜Q16は11/24文書。重大意味差異1件でケース不合格。
- 外部接続：Web APIとPlugin/MCPの仕様・権限を分離。メール閲覧/送信、児童ファイル探索、学校データへのアクセス権は要求しない。
- GPTの実設定・Knowledge・Conversation Starters・Actionsは本人アカウントから未取得。既存設定を複製したとは言わない。
- Plugin作成、アカウント移行、接続、動作検証、共有、切替は未実施。準備資料と実移行は別状態。

## 7. 本人に必要な作業（期限に関わるもの）

2026-12-11までに、本人が所有する最新の公開済みGlobal Parents GPTについて、My GPTsの編集画面から次を原本として安全な個人保管先へ保存する：
- Instructions全文
- Knowledgeに添付した各ファイルとファイル名
- Conversation Starters
- ActionsのOpenAPI schema、認証方式、Privacy Policy URL（存在する場合）
- GPT名・説明・推奨モデル・有効Capabilities
- Version history上の最新公開版がどれか

元GPTやKnowledgeを削除・切替しない。移行ボタンはまだ押さない。本人のアカウントに「Migrate to plugin」が表示されるかを確認するだけにとどめる。機密情報や児童の個人情報はGitHubへ保存しない。

## 8. 公式参考資料（確認日：2026-11-25）

1. OpenAI, Custom GPT retirement and migration FAQ（2026-11-25閲覧）：https://help.openai.com/en/articles/20001519-custom-gpt-retirement-and-migration-faq
2. OpenAI, Creating and editing GPTs（2026-11-25閲覧）：https://help.openai.com/en/articles/8554397-creating-and-editing-gpts
3. Cloudflare, Workers AI Pricing（Last updated 2026-11-18）：https://developers.cloudflare.com/workers-ai/platform/pricing/
4. Cloudflare, Durable Objects Pricing（Last updated 2026-11-13）：https://developers.cloudflare.com/durable-objects/platform/pricing/
5. Cloudflare, Workers Spend Management（Last updated 2026-11-13）：https://developers.cloudflare.com/workers/platform/spend-management/
6. Cloudflare, Durable Objects Spend Management（Last updated 2026-11-13）：https://developers.cloudflare.com/durable-objects/platform/spend-management/
7. Cloudflare, Billing Spend Management（Last updated 2026-11-13）：https://developers.cloudflare.com/billing/manage/spend-management/
8. Cloudflare, AI Gateway Spend Limits：https://developers.cloudflare.com/ai-gateway/features/spend-limits/

注意：AI Gatewayの費用計測はbest-effort estimateであり、厳密な請求額ではない。本人のプランと利用可否は未確認。

## 9. 本作業の実施記録

- 2026-11-25：Repo、PR #4、PR #5、main、既存budget branch、portable workflow、migration readiness、translation connection、関連コードとテストを再取得。
- 2026-11-25：古い日次の疑似IDカウンターを一定期間後に削除する処理を追加し、既存テストの保持期待値を更新。
- 2026-11-25：ローカルNode/SQLiteで26件成功。最初の確認では旧保持仕様の期待値が残る1テスト失敗があり、テスト期待値を新しい保持仕様に修正して再実行後26件成功。
- 2026-11-25：CloudflareとOpenAI公式文書を再調査し、Spend Limitの除外費用・アカウント単位の影響・Custom GPT移行期限を反映。
- 外部API・実AI・決済・Cloudflare設定/デプロイ・Secrets/権限変更・main変更・PR merge・公開・SNS投稿は行っていない。追加費用0円。
