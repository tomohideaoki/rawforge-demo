# オフライン原稿チェッカー実行結果（2026-10-23）

対象: tools/check_content_drafts.py（GitHub上のソースを取得してローカル実行環境に同内容を保存）
方法: Python標準ライブラリのみ。隔離した一時フォルダに人工的なMarkdownサンプルを作成し、実行結果と終了コードを確認。外部通信・AI・課金・投稿・GitHub Actions実行なし。

| ケース | 観測結果 | 終了コード | 判定 |
| --- | --- | --- | --- |
| 正常Markdown | PASS: 1 markdown file(s) checked | 0 | 期待どおり |
| 未公開URLの仮置き | unpublished-link placeholder remains | 1 | 期待どおり |
| ダミーAPIキー文字列 | possible API key | 1 | 期待どおり |
| 存在しないMarkdown | unable to read | 1 | 期待どおり |
| Python構文 | py_compile成功 | 0 | 期待どおり |

注意: このチェッカーは特定の仮置き文言と簡易正規表現のみを検出する。機密情報の漏えい防止、広告表示義務、A8.netの提携条件、公開可否の完全判定ではない。実際の事業原稿すべての検査・GitHub Actionsでの定期実行は未実施。

次の安全な作業: 公開前原稿のチェック項目を整理し、必要に応じてローカルテストを追加。公開・SNS投稿・mainマージ・AI実行・外部サービス変更は別途承認を要する。
