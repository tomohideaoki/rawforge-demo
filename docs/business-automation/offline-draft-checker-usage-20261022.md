# 無料・オフライン原稿チェッカー（試験用、未実行）
追加ファイル：tools/check_content_drafts.py

## 目的
noteやX向けのMarkdown原稿に、未公開記事への仮リンクや明白な認証情報らしき文字列が残っていないか、Python標準ライブラリのみで点検する。**自動投稿、記事生成、売上計測、GitHub Actions実行は行わない。**

## 使い方（将来のレビュー用）
`python tools/check_content_drafts.py docs/business-automation/daddyztimeclub-x-to-note-draft-set-20261022.md`

該当の未公開リンク表記がある場合は終了コード1を返す想定。これは原稿に下書き用プレースホルダーがあることを示し、原稿自体の不備を意味しない。

## 制限
単純な正規表現検査であり、秘密情報をすべて検出できるわけではない。誤検知もあり得る。公開前の人による確認が必要。外部通信・ファイル書き換え・SNS接続なし。

## 実行承認
GitHub Actionsへの組込み、定期実行、既存テストの変更は未承認。今回はスクリプトを作業用ブランチに置くだけ。
