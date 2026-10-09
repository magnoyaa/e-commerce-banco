// =====================================================
// 10_mongodb.js - intro ao MongoDB (dominio: E-commerce)
// Rodar: mongosh < 10_mongodb.js   (ou mongosh --file 10_mongodb.js)
// Autor: Antonio Magno Marinho Costa Junior (ADS)
// =====================================================

use("ecommerce_nosql");

// limpa tudo pra poder rodar varias vezes sem dar ruim
db.clientes.drop();
db.produtos.drop();
db.pedidos.drop();

// ---------- ids fixos pra facilitar o REFERENCING ----------
const cli1 = ObjectId("650000000000000000000001");
const cli2 = ObjectId("650000000000000000000002");
const cli3 = ObjectId("650000000000000000000003");

const p1 = ObjectId("650000000000000000000011");
const p2 = ObjectId("650000000000000000000012");
const p3 = ObjectId("650000000000000000000013");
const p4 = ObjectId("650000000000000000000014");
const p5 = ObjectId("650000000000000000000015");

// ---------- CLIENTES (3 docs) ----------
// enderecos EMBUTIDOS (embedding): sempre lidos junto com o cliente e sao poucos
db.clientes.insertMany([
  {
    _id: cli1,
    nome: "Ana Souza",
    email: "ana@email.com",
    enderecos: [
      { tipo: "casa", cidade: "Sao Luis", uf: "MA", cep: "65000-000" },
      { tipo: "trabalho", cidade: "Sao Jose de Ribamar", uf: "MA", cep: "65110-000" }
    ]
  },
  {
    _id: cli2,
    nome: "Bruno Lima",
    email: "bruno@email.com",
    enderecos: [{ tipo: "casa", cidade: "Imperatriz", uf: "MA", cep: "65900-000" }],
    instagram: "@brunolima" // campo que so ele tem (flexibilidade de esquema)
  },
  {
    _id: cli3,
    nome: "Carla Mendes",
    email: "carla@email.com",
    enderecos: [],
    vip: true,
    pontos_fidelidade: 1200 // outro campo extra, sem ALTER TABLE
  }
]);

// ---------- PRODUTOS (5 docs) ----------
// cada tipo de produto tem atributos diferentes -> no SQL seria um inferno de colunas NULL
db.produtos.insertMany([
  { _id: p1, nome: "Notebook Gamer X", categoria: "informatica", preco: 4500.0, estoque: 10,
    descricao: "Notebook gamer com placa de video dedicada",
    specs: { ram_gb: 16, ssd_gb: 512, tela_pol: 15.6 } },
  { _id: p2, nome: "Mouse Sem Fio", categoria: "informatica", preco: 89.9, estoque: 100,
    descricao: "Mouse sem fio ergonomico", specs: { dpi: 1600, bluetooth: true } },
  { _id: p3, nome: "Camiseta Dev", categoria: "roupas", preco: 59.9, estoque: 50,
    descricao: "Camiseta preta de algodao",
    tamanhos: ["P", "M", "G"], cor: "preta" },
  { _id: p4, nome: "Livro de Banco de Dados", categoria: "livros", preco: 120.0, estoque: 20,
    descricao: "Livro sobre modelagem de banco de dados", autor: "Fulano", paginas: 400 },
  { _id: p5, nome: "Fone Bluetooth", categoria: "audio", preco: 199.0, estoque: 30,
    descricao: "Fone bluetooth com cancelamento de ruido",
    specs: { bateria_h: 30, bluetooth: true } }
]);

// ---------- PEDIDOS (4 docs) ----------
// itens EMBUTIDOS (com nome/preco copiados = "foto" do momento da compra)
// cliente_id e produto_id sao REFERENCIAS (so o _id)
db.pedidos.insertMany([
  { cliente_id: cli1, data: new Date("2026-09-01"), status: "entregue",
    itens: [
      { produto_id: p1, nome: "Notebook Gamer X", qtd: 1, preco_unit: 4500.0 },
      { produto_id: p2, nome: "Mouse Sem Fio", qtd: 1, preco_unit: 89.9 }
    ], total: 4589.9 },
  { cliente_id: cli1, data: new Date("2026-09-20"), status: "enviado",
    itens: [{ produto_id: p4, nome: "Livro de Banco de Dados", qtd: 2, preco_unit: 120.0 }],
    total: 240.0 },
  { cliente_id: cli2, data: new Date("2026-09-25"), status: "pendente",
    itens: [{ produto_id: p3, nome: "Camiseta Dev", qtd: 3, preco_unit: 59.9 }],
    total: 179.7, cupom: "DEV10" }, // campo so desse pedido
  { cliente_id: cli3, data: new Date("2026-10-02"), status: "entregue",
    itens: [
      { produto_id: p5, nome: "Fone Bluetooth", qtd: 1, preco_unit: 199.0 },
      { produto_id: p2, nome: "Mouse Sem Fio", qtd: 2, preco_unit: 89.9 }
    ], total: 378.8 }
]);

print("Total de documentos:",
  db.clientes.countDocuments() + db.produtos.countDocuments() + db.pedidos.countDocuments());

// =====================================================
// CONSULTAS
// =====================================================

// 1) filtro: produtos de informatica com preco < 1000
db.produtos.find({ categoria: "informatica", preco: { $lt: 1000 } });

// 2) filtro + projecao (so nome e preco, sem _id) + sort (mais caro primeiro)
db.produtos.find({ preco: { $gt: 50 } }, { _id: 0, nome: 1, preco: 1 }).sort({ preco: -1 });

// 3) pedidos de um cliente, mais recentes primeiro, so alguns campos
db.pedidos.find({ cliente_id: cli1 }, { data: 1, status: 1, total: 1 }).sort({ data: -1 });

// 4) busca dentro de array embutido: pedidos que tem mouse
db.pedidos.find({ "itens.nome": "Mouse Sem Fio" }, { _id: 0, status: 1, total: 1 });

// 5) clientes que tem campo extra (flexibilidade)
db.clientes.find({ vip: true }, { _id: 0, nome: 1, pontos_fidelidade: 1 });

// 6) "JOIN" com referencing usando $lookup (pedido + dados do cliente)
db.pedidos.aggregate([
  { $lookup: { from: "clientes", localField: "cliente_id", foreignField: "_id", as: "cliente" } },
  { $unwind: "$cliente" },
  { $project: { _id: 0, cliente: "$cliente.nome", status: 1, total: 1 } }
]);

// =====================================================
// INDICES + EXPLAIN
// =====================================================

// indice 1: simples e unico no email
db.clientes.createIndex({ email: 1 }, { unique: true });

// indice 2: composto (padrao de acesso: pedidos do cliente, mais novos primeiro)
db.pedidos.createIndex({ cliente_id: 1, data: -1 });

// indice 3: texto (busca de produto por palavra)
db.produtos.createIndex({ nome: "text", descricao: "text" });

// explain: tem que aparecer IXSCAN (e nao COLLSCAN)
// dica: no explain, olha winningPlan.stage e totalDocsExamined
printjson(db.pedidos.find({ cliente_id: cli1 }).sort({ data: -1 })
  .explain("executionStats").executionStats);

printjson(db.clientes.find({ email: "ana@email.com" })
  .explain("executionStats").queryPlanner.winningPlan);

// busca de texto
db.produtos.find({ $text: { $search: "bluetooth" } }, { _id: 0, nome: 1 });

// pra comparar: explain SEM indice (campo 'status' nao tem indice -> COLLSCAN)
printjson(db.pedidos.find({ status: "entregue" })
  .explain("executionStats").queryPlanner.winningPlan);
