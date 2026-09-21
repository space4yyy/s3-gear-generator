.PHONY: help install dev worker frontend build-frontend check

help:
	@echo "可用命令："
	@echo "  make install         安装 Worker 依赖"
	@echo "  make dev             同时启动前端和 Worker"
	@echo "  make worker          只启动 Worker（http://127.0.0.1:8787）"
	@echo "  make frontend        只启动前端（监听 0.0.0.0:8080，局域网使用本机 IP 访问）"
	@echo "  make build-frontend  构建前端，需要设置 S3_GEAR_GENERATOR_API_URL"
	@echo "  make check           检查 Worker 代码"

install:
	@cd worker && npm install

dev:
	@echo "前端监听：0.0.0.0:8080（局域网设备使用本机 IP 访问）"
	@echo "Worker 地址：http://127.0.0.1:8787"
	@echo "按 Ctrl+C 停止服务"
	@$(MAKE) --jobs=2 worker frontend

worker:
	@cd worker && npm run dev

frontend:
	@npm run dev:frontend

build-frontend:
	@npm run build:frontend

check:
	@cd worker && npm run check
