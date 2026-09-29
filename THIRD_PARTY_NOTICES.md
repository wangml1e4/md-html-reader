# Third-party code

`src/lib/markdown/lruCache.ts` is copied from [VMark](https://github.com/xiaolai/vmark),
`src/utils/lruCache.ts`, revision `113ad8d1c5b419cc7d2698a753668eb7959070c7`.
Copyright (c) 2026 Xiaolai Li. Distributed under the ISC license in [VMark ISC license](public/third-party/VMark-LICENSE.txt).

The reading pipeline also borrows VMark's architectural ideas: demand-loaded renderers,
bounded caches, and generation tokens that discard stale asynchronous results.
The Vue integration is implemented for this project; it does not import VMark's React/Tiptap application.

`src/lib/cjkFormatter/` adapts VMark's `src/lib/cjkFormatter/` dependency closure
and `src/utils/tableParser.ts` from the same revision. Copyright (c) 2026 Xiaolai Li.
ISC license, reproduced at `public/third-party/VMark-LICENSE.txt`. Changes replace
application settings/debug imports with local types and console warnings; all
formatting rules and integrity checks are retained. Ellipsis normalization also
preserves trailing Markdown hard-break spaces.
