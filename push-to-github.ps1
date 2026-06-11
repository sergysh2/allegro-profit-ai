cd "C:\Users\Computer\Documents\Codex\2026-06-11\allegro-profit-ai-1-2-3"

git init
git branch -M main

git add .gitignore README.md index.html style.css script.js analiza-produktu.html analysis.css analysis.js roadmap.html roadmap.css mvp-v1
git commit -m "Initial commit: Allegro Profit AI" --allow-empty

git remote remove origin 2>$null
git remote add origin https://github.com/sergysh2/allegro-profit-ai.git
git push -u origin main
