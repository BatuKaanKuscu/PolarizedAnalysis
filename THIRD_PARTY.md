# Third-party components

- PDF.js / pdfjs-dist 6.4.299 — Mozilla and contributors, Apache-2.0. Vendored build/pdf.mjs and build/pdf.worker.mjs from the pinned npm package. License: dist/vendor/PDFJS-LICENSE.txt. Source: https://github.com/mozilla/pdf.js
- WebLLM 0.2.86 — MLC AI and contributors, Apache-2.0. Vendored lib/index.js from the pinned npm package as dist/vendor/webllm.mjs. License: dist/vendor/WEBLLM-LICENSE.txt. Source: https://github.com/mlc-ai/web-llm
- Optional Qwen2.5-0.5B-Instruct MLC model — third-party pretrained model, not trained by this project. Weights are not bundled. Downloaded only after a user action from https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC using the WebLLM prebuilt configuration.


Wikipedia text extracts are retrieved on demand through the MediaWiki API. Each result links to the original article (including contributors/history) and CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/. Generated explanations are labeled separately from original excerpts. API documentation: https://www.mediawiki.org/wiki/Extension:TextExtracts .
