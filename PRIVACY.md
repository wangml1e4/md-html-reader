# Privacy statement

[中文](PRIVACY.zh-CN.md) | English

Last updated: 2026-09-22

## Local files

Markdown Reader operates on the folder you explicitly select. Editing, comments, file search, content search, and HTML export run locally. The app does not require an account for these features.

Comments are stored as sidecar data associated with the document path. They are intended to stay with the workspace you selected.

## Optional AI services

AI features are optional and are not used until you choose one and approve an individual request.

For an AI reading version, the app sends the current Markdown document to the provider you selected. For document suggestions or optimization, it sends the current Markdown and that document's unresolved comments. It does not send the whole workspace automatically.

You are responsible for choosing a provider and ensuring you have permission to send the document content to it. Review that provider's terms and privacy policy before use.

## API credentials

For OpenAI-compatible services, the Base URL and selected model can be stored locally for convenience. When you save the settings, the API key is written to a `.env` file in the current user's application configuration directory so it can be reused in later sessions. On Unix systems, the app sets that file to owner-only permissions (`0600`). The key is not stored in the selected workspace or in the operating system keychain; any person or process with access to your user account and that configuration file may be able to read it.

## Data sharing and support

The app has no built-in analytics or account system. If you contact the project team through an external channel, that channel's privacy terms apply. This statement will be updated before a public production release if data practices change.
