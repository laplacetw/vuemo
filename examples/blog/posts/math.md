---
title: Math in posts
date: 2025-08-01 10:00:00
category: Notes
tags:
  - vuemo
description: Formulas with markdown-it-mathjax3
---

Mass and energy are related by $E = mc^2$, rendered at build time.

---

Display math sits on its own line and scrolls sideways when it is wider than the page:

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

Turn it on with `markdown: { math: true }` and install `markdown-it-mathjax3`.
