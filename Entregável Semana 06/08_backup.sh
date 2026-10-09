#!/usr/bin/env bash
# =====================================================
# 08_backup.sh - backup logico do PostgreSQL (pg_dump -Fc)
# Autor: Antonio Magno Marinho Costa Junior (ADS)
#
# Cron (todo dia 02:00):
#   0 2 * * * /opt/projeto/08_backup.sh >> /var/log/backup_pg_cron.log 2>&1
#
# Senha: usa ~/.pgpass (chmod 600) pra nao deixar senha no script
#   formato: localhost:5432:ecommerce:postgres:SUA_SENHA
# =====================================================

set -euo pipefail   # qualquer erro = script para (nada de falha silenciosa)

DB_NAME="${DB_NAME:-ecommerce}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgres}"
RETENCAO_DIAS=30

DATA=$(date +%Y-%m-%d_%H-%M-%S)
ARQUIVO="${BACKUP_DIR}/${DB_NAME}_${DATA}.dump"
LOG="${BACKUP_DIR}/backup.log"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

mkdir -p "$BACKUP_DIR"

# se der ruim no meio, apaga o arquivo quebrado pra nao enganar ninguem
limpar_se_falhar() {
  if [ $? -ne 0 ]; then
    log "ERRO: backup falhou :( removendo arquivo parcial"
    rm -f "$ARQUIVO"
  fi
}
trap limpar_se_falhar EXIT

log "Iniciando backup de '$DB_NAME'..."

if ! command -v pg_dump >/dev/null 2>&1; then
  log "ERRO: pg_dump nao encontrado, instala o postgresql-client"
  exit 1
fi

pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -Fc -f "$ARQUIVO" "$DB_NAME"

# testa se o arquivo eh legivel (nao confia cegamente, ne)
pg_restore --list "$ARQUIVO" >/dev/null
TAMANHO=$(du -h "$ARQUIVO" | cut -f1)
log "OK! Backup criado: $ARQUIVO ($TAMANHO)"

# limpeza: apaga backups com mais de 30 dias
log "Apagando backups com mais de ${RETENCAO_DIAS} dias..."
find "$BACKUP_DIR" -name "${DB_NAME}_*.dump" -type f -mtime +"$RETENCAO_DIAS" -print -delete | tee -a "$LOG"

log "Fim."
