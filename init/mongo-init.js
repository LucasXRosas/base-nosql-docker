/**
 * ============================================================================
 * MONGODB INITIALIZATION SCRIPT — GASTROHUB / PROJETO
 * ============================================================================
 * 
 * Este arquivo é executado automaticamente na primeira inicialização do MongoDB.
 * Aqui você define:
 * 1. O banco de dados do seu sistema
 * 2. As coleções
 * 3. A criação de ÍNDICES (performance e unicidade)
 * 4. A inserção dos dados iniciais
 */

db = db.getSiblingDB("gastrohub");

// ── 1. COLEÇÃO SIMPLES: itens (para início rápido) ───────────────────────────
db.createCollection("itens");
db.itens.createIndex({ "categoria": 1 });
db.itens.createIndex({ "preco": 1 });

db.itens.insertMany([
  { nome: "Pizza Margherita", categoria: "Pizzas", preco: 45.90, tags: ["italiana", "queijo"] },
  { nome: "Combo Sashimi", categoria: "Japonesa", preco: 69.90, tags: ["peixe", "fresco"] },
  { nome: "Classic Burger", categoria: "Burgers", preco: 32.90, tags: ["artesanal", "carne"] },
  { nome: "Taco de Carne", categoria: "Mexicana", preco: 19.90, tags: ["crocante", "picante"] },
  { nome: "Prato Feito Mineiro", categoria: "Brasileira", preco: 24.90, tags: ["caseira", "completo"] }
]);

// ── 2. COLEÇÃO: restaurantes ──────────────────────────────────────────────────
db.createCollection("restaurantes");
db.restaurantes.createIndex({ "nome": 1 });
db.restaurantes.createIndex({ "ativo": 1 });
db.restaurantes.createIndex({ "categorias": 1 });

db.restaurantes.insertMany([
  {
    nome: "Sushi Kazu",
    endereco: { rua: "Rua das Flores", numero: 120, cidade: "Guarapuava", cep: "85010-000" },
    categorias: ["Japonesa", "Asiática"],
    horario: { abertura: "11:00", fechamento: "23:00" },
    avaliacao_media: 4.7,
    ativo: true
  },
  {
    nome: "Pizzaria Napoli",
    endereco: { rua: "Av. Manoel Ribas", numero: 450, cidade: "Guarapuava", cep: "85010-100" },
    categorias: ["Italiana", "Pizzaria"],
    horario: { abertura: "18:00", fechamento: "00:00" },
    avaliacao_media: 4.3,
    ativo: true
  },
  {
    nome: "Burger House",
    endereco: { rua: "Rua XV de Novembro", numero: 88, cidade: "Guarapuava", cep: "85010-200" },
    categorias: ["Hambúrguer", "Fast Food"],
    horario: { abertura: "11:30", fechamento: "22:00" },
    avaliacao_media: 4.1,
    ativo: true
  },
  {
    nome: "Sabor Mineiro",
    endereco: { rua: "Rua Saldanha Marinho", numero: 300, cidade: "Guarapuava", cep: "85010-300" },
    categorias: ["Brasileira", "Comida Caseira"],
    horario: { abertura: "11:00", fechamento: "15:00" },
    avaliacao_media: 4.5,
    ativo: true
  },
  {
    nome: "Taco Loco",
    endereco: { rua: "Rua Benjamin Constant", numero: 55, cidade: "Guarapuava", cep: "85010-400" },
    categorias: ["Mexicana"],
    horario: { abertura: "12:00", fechamento: "22:30" },
    avaliacao_media: 3.9,
    ativo: false
  }
]);

const restaurantes = db.restaurantes.find().toArray();
const idSushi = restaurantes[0]._id;
const idPizzaria = restaurantes[1]._id;
const idBurger = restaurantes[2]._id;
const idMineiro = restaurantes[3]._id;
const idTaco = restaurantes[4]._id;

// ── 3. COLEÇÃO: cardapio ─────────────────────────────────────────────────────
db.createCollection("cardapio");
db.cardapio.createIndex({ "restaurante_id": 1 });
db.cardapio.createIndex({ "preco": 1 });
db.cardapio.createIndex({ "categoria": 1 });

db.cardapio.insertMany([
  { restaurante_id: idSushi, nome: "Combo Sashimi", descricao: "15 fatias de sashimi variado", preco: 69.90, categoria: "Combos", disponivel: true, ingredientes: ["salmão", "atum", "peixe branco"], alergenos: ["peixe"] },
  { restaurante_id: idSushi, nome: "Temaki Salmão", descricao: "Temaki de salmão com cream cheese", preco: 28.90, categoria: "Temaki", disponivel: true, ingredientes: ["salmão", "cream cheese", "arroz", "nori"], alergenos: ["peixe", "leite"] },
  { restaurante_id: idSushi, nome: "Hot Roll", descricao: "8 unidades empanadas com cream cheese", preco: 32.90, categoria: "Empanados", disponivel: true, ingredientes: ["salmão", "cream cheese", "arroz"], alergenos: ["peixe", "leite", "glúten"] },
  { restaurante_id: idPizzaria, nome: "Pizza Margherita", descricao: "Molho de tomate, mozzarella e manjericão", preco: 45.90, categoria: "Pizzas", disponivel: true, ingredientes: ["molho de tomate", "mozzarella", "manjericão"], alergenos: ["leite", "glúten"] },
  { restaurante_id: idPizzaria, nome: "Pizza Calabresa", descricao: "Calabresa fatiada com cebola", preco: 42.90, categoria: "Pizzas", disponivel: true, ingredientes: ["calabresa", "cebola", "mozzarella"], alergenos: ["leite", "glúten"] },
  { restaurante_id: idPizzaria, nome: "Calzone Frango", descricao: "Calzone recheado com frango e catupiry", preco: 38.90, categoria: "Calzones", disponivel: false, ingredientes: ["frango", "catupiry", "massa"], alergenos: ["leite", "glúten"] },
  { restaurante_id: idBurger, nome: "Classic Burger", descricao: "Hambúrguer artesanal 180g com queijo", preco: 32.90, categoria: "Burgers", disponivel: true, ingredientes: ["carne bovina", "queijo cheddar", "alface", "tomate"], alergenos: ["leite", "glúten"] },
  { restaurante_id: idBurger, nome: "Smash Burger", descricao: "Dois smash patties com cebola caramelizada", preco: 36.90, categoria: "Burgers", disponivel: true, ingredientes: ["carne bovina", "cebola", "queijo", "pão brioche"], alergenos: ["leite", "glúten"] },
  { restaurante_id: idBurger, nome: "Batata Frita G", descricao: "Porção grande de batata frita crocante", preco: 18.90, categoria: "Acompanhamentos", disponivel: true, ingredientes: ["batata"], alergenos: [] },
  { restaurante_id: idMineiro, nome: "Prato Feito", descricao: "Arroz, feijão, bife, ovo frito e salada", preco: 24.90, categoria: "Pratos", disponivel: true, ingredientes: ["arroz", "feijão", "carne bovina", "ovo"], alergenos: ["ovo"] },
  { restaurante_id: idMineiro, nome: "Frango com Quiabo", descricao: "Frango caipira com quiabo e angu", preco: 29.90, categoria: "Pratos", disponivel: true, ingredientes: ["frango", "quiabo", "fubá"], alergenos: ["glúten"] },
  { restaurante_id: idMineiro, nome: "Pão de Queijo (10un)", descricao: "Pão de queijo mineiro artesanal", preco: 15.90, categoria: "Lanches", disponivel: true, ingredientes: ["polvilho", "queijo", "ovo"], alergenos: ["leite", "ovo"] },
  { restaurante_id: idTaco, nome: "Taco de Carne", descricao: "Tortilha com carne moída temperada", preco: 19.90, categoria: "Tacos", disponivel: true, ingredientes: ["carne moída", "tortilha", "alface", "queijo"], alergenos: ["leite", "glúten"] },
  { restaurante_id: idTaco, nome: "Burrito Frango", descricao: "Burrito grande com frango desfiado", preco: 28.90, categoria: "Burritos", disponivel: true, ingredientes: ["frango", "arroz", "feijão", "tortilha"], alergenos: ["glúten"] },
  { restaurante_id: idTaco, nome: "Nachos Supreme", descricao: "Nachos com guacamole e sour cream", preco: 34.90, categoria: "Porções", disponivel: true, ingredientes: ["tortilha chips", "guacamole", "sour cream", "jalapeño"], alergenos: ["leite"] }
]);

// ── 4. COLEÇÃO: clientes ─────────────────────────────────────────────────────
db.createCollection("clientes");
db.clientes.createIndex({ "email": 1 }, { unique: true });
db.clientes.createIndex({ "telefone": 1 });

db.clientes.insertMany([
  {
    nome: "Ana Silva",
    email: "ana@email.com",
    telefone: "42999001001",
    enderecos: [
      { rua: "Rua Guaíra", numero: 200, cidade: "Guarapuava", cep: "85015-000", principal: true },
      { rua: "Rua Ponta Grossa", numero: 50, cidade: "Guarapuava", cep: "85015-100", principal: false }
    ],
    favoritos: [idSushi, idBurger]
  },
  {
    nome: "Bruno Costa",
    email: "bruno@email.com",
    telefone: "42999002002",
    enderecos: [
      { rua: "Av. Manoel Ribas", numero: 1500, cidade: "Guarapuava", cep: "85010-500", principal: true }
    ],
    favoritos: [idPizzaria]
  },
  {
    nome: "Carla Mendes",
    email: "carla@email.com",
    telefone: "42999003003",
    enderecos: [
      { rua: "Rua Saldanha Marinho", numero: 800, cidade: "Guarapuava", cep: "85010-300", principal: true }
    ],
    favoritos: [idMineiro, idSushi]
  }
]);

print("=== [MongoDB] Inicialização concluída com sucesso! ===");
