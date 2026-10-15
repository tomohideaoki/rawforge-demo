# Copilot Free 手動試験（まだ実行しない）

## 目的

Actions上のCopilot CLIが、名前入力欄へmaxlength="100"を付ける小さなコード改善を1件提案し、既存19件のテストを通せるか検証する準備です。現在のJavaScriptの名前処理は100文字までなので、入力UIにも同じ上限を設けます。
このPRは準備だけです。AIを呼び出さず、アプリ本体も変更しません。
将来の試験でも書き込み権限を持たず、修正案は1日保存のpatch artifactだけにします。自動PR作成は次段階です。

## 公式仕様（2026-10-15確認）

- Copilot CLIは全Copilotプランで利用可能。ActionsからPATを用いて非対話実行する公式手順があります。
- Copilot Freeはモデル自動選択のみ。月2,000件のコード補完はCLI実行2,000回を意味しません。
- CLIはAIクレジットを消費します。公式プランページはFreeのクレジット数を明記していません。残枠・利用可能状態は本人アカウントで確認が必要です。
- 公開リポジトリの標準GitHubホストランナー実行料は無料。保存量は別管理なので成果物は小さなpatchのみ、保持1日です。

Sources:
- https://docs.github.com/en/copilot/how-tos/copilot-cli/automate-copilot-cli/automate-with-actions
- https://docs.github.com/en/copilot/get-started/plans
- https://docs.github.com/en/copilot/concepts/billing-and-usage/individuals/billing
- https://docs.github.com/en/billing/concepts/product-billing/github-actions

## 実行前に必要な確認と設定（今回変更しない）

1. トークン所有者がCopilot Freeであること、残枠があること、有料契約・追加利用予算・自動補充が有効でないことをGitHub本人設定で確認します。追加料金が必要なら停止します。
2. 個人用の細粒度PATを作成し、Account permissionsのCopilot Requestsのみ付与します。リポジトリの書き込み権限は不要です。期限を短くし、Actions Secret `COPILOT_GITHUB_TOKEN`に保存します。チャットやコードには貼りません。
3. 上記の確認後に限り、Repository variable `COPILOT_FREE_TRIAL_APPROVED` を文字列 `true` に設定します。これは人による確認記録であり、GitHubの課金設定を強制する機能ではありません。
4. workflow_dispatchにはworkflowがデフォルトブランチに存在する必要があります。本PRのマージは別途承認が必要です。ブランチに置いただけでは通常のRun workflowから試験できません。
5. AI試験実行の承認後、Run workflowで `confirm_free_only` をtrueにして1回だけ実行します。

## 費用と制限

想定追加費用は0円（Freeの残枠内・有料利用無効・標準公開ランナー・保存枠内が前提）。YAML単体で契約状態や請求上限を検証することはできません。課金設定の確認ができるまで承認変数は未設定のままにします。
CLIは1回起動のみ、120秒で停止、workflow全体8分、再試行・有料プロバイダーへの切替はありません。CLI内部で複数回の推論が行われる可能性はあり、1回起動=1クレジットではありません。失敗でも消費が発生し得ます。
モデルは固定せずFreeの自動選択を使用します。CLIは1.0.98に固定しています。実行前に配布・オプション互換性を確認し、不一致なら停止します。

## 安全性と検証範囲

CLIをリポジトリ外の一時ディレクトリで起動し、渡すコードは名前inputタグ1個のみ。許可する変更はmaxlength="100"の追加だけで、JSONを機械検証します。AIの出力をコマンドとして実行しません。shell/read/write/url/memory/githubツールを拒否し、書き込み用トークンは渡しません。
テスト実行時にCopilot PATを渡しません。認証情報・生のAI出力は成果物に含めません。PR・main・Cloudflareへの変更処理は存在しません。推論用PATはCLIプロセスに渡るため、固定版配布元の信頼は前提です。
オフライン検証: `python3 tests/copilot-trial.test.py` と `node --test tests/*.test.cjs`。これらはAIを呼びません。
実ブラウザの入力制限確認は別途必要です。この試験の成功は汎用の自律開発精度や無料枠での毎日運用を保証しません。
