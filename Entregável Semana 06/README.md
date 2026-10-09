# sistema de e-commerce - postgresql + mongodb (sprint 6)

antonio magno marinho costa junior - ads

projeto de banco de dados de uma loja virtual. na sprint 5 foi tudo no postgresql (modelagem, indices, transacoes, permissoes, explain). agora na sprint 6 entrou backup/restauracao e uma parte de mongodb

## 1. dominio e modelo logico

loja virtual onde clientes fazem pedidos de produtos. o banco guarda clientes, enderecos, produtos, categorias, fornecedores, pedidos, itens do pedido, pagamentos, cupons, transportadoras e avaliacoes

tabelas no postgres:
- clientes
- enderecos
- categorias
- fornecedores
- produtos
- pedidos
- itens_pedido
- pagamentos
- cupons
- transportadoras
- avaliacoes

relacoes principais
- cliente tem endereco
- cliente faz varios pedidos
- pedido tem varios itens
- item aponta pra um produto
- produto tem categoria e fornecedor
- pedido tem um pagamento
- cliente avalia produto

pk e fk garantem a integridade, e tem unique, check, not null e default tbm (ta detalhado no readme da sprint 5)

no mongodb (banco ecommerce_nosql) ficou assim:

    clientes  { _id, nome, email, enderecos: [ {...} ] }
    produtos  { _id, nome, categoria, preco, estoque, specs ... }
    pedidos   { _id, cliente_id, data, status, itens: [ {produto_id, nome, qtd, preco_unit} ], total }

## 2. arquivos

- 01_ddl.sql - tabelas
- 02_inserts.sql - dados
- 03_indices.sql - indices
- 04_consultas.sql - 15 consultas
- 05_transacoes.sql - commit e rollback
- 06_permissoes.sql - usuarios, grant, revoke
- 07_explain.sql - explain analyze
- 08_backup.sh - backup automatico (novo)
- 09_restore_teste.sh - teste de restauracao (novo)
- 10_mongodb.js - mongodb (novo)

## 3. backup

o 08_backup.sh usa pg_dump com -Fc (formato customizado, vem compactado e da pra restaurar com pg_restore, ate so uma tabela se quiser)

o que o script faz
- gera o arquivo com data no nome, tipo ecommerce_2026-10-09_02-00-01.dump
- se der erro ele para (set -euo pipefail), apaga o arquivo incompleto e registra no backup.log
- depois do dump roda pg_restore --list pra ver se o arquivo abre
- apaga backups com mais de 30 dias (find -mtime +30 -delete)
- a senha fica no ~/.pgpass, nao no script

pra rodar:

    chmod +x 08_backup.sh
    ./08_backup.sh

o nome do banco padrao é ecommerce, se for outro: DB_NAME=nomedobanco ./08_backup.sh

### cron

editar com crontab -e e colocar:

    0 2 * * * /opt/projeto/08_backup.sh >> /var/log/backup_pg_cron.log 2>&1

ou seja minuto 0, hora 2, todo dia/mes/dia da semana = roda todo dia as 2h da manha

### regra 3-2-1

- 3 copias dos dados: o banco em producao + backup local + backup remoto
- 2 midias diferentes: disco do servidor e nuvem (ou hd externo)
- 1 copia fora do local: bucket na nuvem tipo s3 ou google drive, da pra mandar com rclone

o script faz a parte local, pra fechar o 3-2-1 falta mandar o .dump pra fora (rclone copy /var/backups/postgres remoto:backups, por exemplo, tbm no cron)

## 4. teste de restauracao

backup sem teste nao vale nada, entao o 09_restore_teste.sh restaura o dump num banco separado e compara com o original

    ./09_restore_teste.sh /var/backups/postgres/ecommerce_2026-10-09_02-00-01.dump

passos
1. recria o banco ecommerce_teste
2. pg_restore --no-owner nesse banco
3. faz select count(*) das 11 tabelas nos dois bancos e compara

na mao seria:

    createdb ecommerce_teste
    pg_restore -d ecommerce_teste --no-owner arquivo.dump
    psql -d ecommerce_teste -c "SELECT COUNT(*) FROM pedidos;"

resultado:

    TABELA          ORIGINAL  RESTAURADO  STATUS
    clientes              10          10  OK
    produtos              20          20  OK
    pedidos               15          15  OK
    ...
    Backup valido, os dados batem

se todas as contagens batem o backup ta integro

## 5. mongodb

arquivo 10_mongodb.js, roda com mongosh --file 10_mongodb.js

o que tem la
- 3 collections (clientes, produtos, pedidos) e 12 documentos
- esquema flexivel: o bruno tem campo instagram, a carla tem vip e pontos_fidelidade, a camiseta tem tamanhos e o notebook tem specs. nenhum alter table
- consultas com find, filtro, sort e projecao, busca dentro de array (itens.nome) e um $lookup (tipo join)
- 3 indices: simples unico (clientes.email), composto (pedidos cliente_id + data) e de texto (produtos nome + descricao)
- explain("executionStats") nas consultas

sobre o explain: com indice aparece IXSCAN e examina so os docs necessarios. na busca por status (sem indice) aparece COLLSCAN que le a collection toda. com poucos docs quase nao muda o tempo mas com muito pedido faz bastante diferenca

### embedding vs referencing

regra: modelar pelo padrao de acesso

- enderecos dentro de clientes (embedding): sempre lido junto com o cliente, sao poucos e nao crescem sem limite
- itens dentro de pedidos (embedding): ninguem consulta item sozinho, abrir o pedido ja traz tudo numa leitura so. o nome e preco_unit ficam copiados pq o pedido precisa guardar o preco da hora da compra, mesmo se o produto mudar depois
- cliente_id em pedidos (referencing): cliente pode ter milhares de pedidos (cresce pra sempre) e o pedido tbm é consultado sozinho. embutir ia inchar o doc do cliente (limite de 16mb)
- produto_id nos itens (referencing): produto existe por conta propria, estoque e preco mudam separado e ele aparece em varios pedidos. duplicar tudo ia dar inconsistencia

resumindo: dado que anda junto e tem tamanho limitado = embutir. dado que vive sozinho ou cresce sem parar = referenciar

## 6. postgresql x mongodb no e-commerce

postgresql é melhor pra
- pedidos, pagamentos e estoque (envolve dinheiro, precisa de transacao acid, check e fk)
- relatorios com varios joins e agregacoes (faturamento por categoria, clientes que mais compram)
- regras rigidas (cpf unico, nota de 1 a 5, status validos)

mongodb se sai melhor em
- catalogo de produtos com atributos diferentes (notebook, roupa, livro), sem um monte de coluna null
- carrinho, sessao, historico de navegacao, logs (muita escrita e esquema que muda toda hora)
- buscar um documento inteiro de uma vez (pedido com itens) sem join
- escalar horizontal com muito volume (sharding)

conclusao: no nosso e-commerce o postgres fica com o nucleo financeiro (pedidos, pagamentos, estoque) e o mongo com catalogo e dados de comportamento. da pra usar os dois juntos. nao é um melhor que o outro, depende do problema

## 7. tecnologias

postgresql, mongodb (mongosh), bash, cron, dbeaver
