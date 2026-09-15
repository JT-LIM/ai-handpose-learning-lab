.PHONY: preview test deploy
preview:
	python3 -m http.server 8016 --bind 127.0.0.1
test:
	node --check app.js
	node --test tests/*.test.cjs
deploy:
	@test "$$(git branch --show-current)" = "main"
	@test -z "$$(git status --porcelain)" || { echo "변경 파일을 먼저 커밋하세요."; exit 1; }
	git push origin main
