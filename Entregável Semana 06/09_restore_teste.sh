#!/usr/bin/env bash
# =====================================================
# 09_restore_teste.sh - restaura o backup num banco de TESTE
# e compara a contagem de registros com o banco original.
# Uso: ./09_restore_teste.sh /var/backups/postgres/ecommerce_2026-10-09_02-00-01.dump
# =====================================================

set -euo pipefail

ARQUIVO="${1:?Passa o caminho do .dump, ex: ./09_restore_teste.sh arquivo.dump}"
DB_ORIGEM="${DB_ORIGEM:-ecommerce}"
DB_TESTE="ecommerce_teste"
DB_USER="${DB_USER:-postgres}"

echo ">> recriando banco de teste ($DB_TESTE)"
dropdb  -U "$DB_USER" --if-exists "$DB_TESTE"
createdb -U "$DB_USER" "$DB_TESTE"

echo ">> restaurando..."
pg_restore -U "$DB_USER" -d "$DB_TESTE" --no-owner --exit-on-error "$ARQUIVO"

# tabelas pra conferir (ajusta pro seu modelo)
TABELAS=(clientes enderecos categorias fornecedores produtos pedidos itens_pedido pagamentos cupons transportadoras avaliacoes)

echo
printf "%-15s %10s %10s  %s\n" "TABELA" "ORIGINAL" "RESTAURADO" "STATUS"
FALHOU=0
for t in "${TABELAS[@]}"; do
  a=$(psql -U "$DB_USER" -d "$DB_ORIGEM" -Atc "SELECT COUNT(*) FROM $t")
  b=$(psql -U "$DB_USER" -d "$DB_TESTE"  -Atc "SELECT COUNT(*) FROM $t")
  if [ "$a" = "$b" ]; then s="OK"; else s="DIFERENTE!!"; FALHOU=1; fi
  printf "%-15s %10s %10s  %s\n" "$t" "$a" "$b" "$s"
done

echo
if [ "$FALHOU" -eq 0 ]; then
  echo "Backup valido, os dados batem :)"
else
  echo "Deu ruim, contagens diferentes. Backup NAO eh confiavel."
  exit 1
fi
