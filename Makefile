.PHONY: help setup install db-init db-migrate db-seed dev api mcp typecheck test build lint format provision status

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-14s\033[0m %s\n", $$1, $$2}'

setup: provision install db-init db-migrate db-seed ## Full native setup (no Docker): provision deps, install JS deps, init + migrate + seed DB

provision: ## Install native system dependencies (Debian/Ubuntu)
	@bash scripts/provision/debian.sh

install: ## Install JS dependencies (corepack pnpm)
	@corepack enable && pnpm install

db-init: ## Create PostgreSQL database + role (idempotent)
	@bash scripts/db/init.sh

db-migrate: ## Run Drizzle migrations
	@pnpm --filter @opentelecrm/db migrate

db-seed: ## Seed demo enterprise, 3 users, 5,000 leads, 2 pipelines, 20 custom fields
	@pnpm --filter @opentelecrm/db seed

dev: ## Run API in dev mode
	@pnpm --filter @opentelecrm/api dev

api: dev

mcp: ## Run MCP server in dev mode
	@pnpm --filter @opentelecrm/mcp dev

typecheck: ## Typecheck all workspaces
	@pnpm turbo run typecheck

test: ## Run all tests
	@pnpm turbo run test

build: ## Build all workspaces
	@pnpm turbo run build

lint: ## Lint all workspaces
	@pnpm turbo run lint

status: ## Show service status (systemd units)
	@systemctl --user list-units 'opentelecrm-*' --no-pager || true
	@systemctl list-units 'opentelecrm-*' --no-pager || true
