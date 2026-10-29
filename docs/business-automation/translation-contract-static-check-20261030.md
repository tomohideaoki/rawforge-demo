# 2026-10-30 翻訳契約の静的チェック（PR #4 vs 模擬Worker）

対象: PR #4 head の index.html、prep/mock-worker-20261028 の experiments/mock-worker-handler.mjs、prep/frontend-worker-regression-20261029 の tests/translation-worker-contract.test.cjs。
GitHubのファイル内容を直接取得し、ソース文字列と関数呼出しを照合。これは静的確認であり、Node回帰テストの実行ではない。

## 確認結果
- PR #4 のフロントエンド: GP_TRANSLATION_ENABLED=false。実AI実行は無効。
- PR #4 の送信本文: JSON.stringify({ text })。同意フラグ consent を送らない。
- 模擬Worker: authorizeTranslation(...) に payload を渡し、サーバー側の同意判定と利用制限を要求する構成。
- 統合テストは consent:true の送信を期待するが、PR #4 head の実HTMLとは別ブランチであり、これだけでPR #4の本番コードが修正済みとはいえない。

## 統合前の必須修正
1. PR #4のフロントエンドで、利用者の同意がある場合のみ JSON.stringify({ text, consent: true }) を送る。
2. Worker側で consent===true をサーバーでも確認。ブラウザ上のチェックだけを信頼しない。
3. 両者を同一作業ブランチに揃え、実HTMLを読み込むNode回帰テスト全体をオフラインで実行。
4. 有効化・本番公開・外部AI実行・main変更は別途承認まで停止。

## 現在の判定
**未統合**。PR #4の実HTMLとサーバー側の同意契約に差異が残る。安全な有効化条件は未達成。

## 範囲・費用
外部API通信・AI・Actions実行・SNS投稿・公開・main変更・権限/Secret変更なし。追加の有料操作なし。本人アカウントの請求額は未確認。
