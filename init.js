db = db.getSiblingDB("gastrohub");

// ========================================
// Coleção: restaurantes
// ========================================
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

// ========================================
// Coleção: cardapio
// ========================================
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

// ========================================
// Coleção: clientes
// ========================================
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
    nome: "Carla Oliveira",
    email: "carla@email.com",
    telefone: "42999003003",
    enderecos: [
      { rua: "Rua Saldanha Marinho", numero: 800, cidade: "Guarapuava", cep: "85010-600", principal: true }
    ],
    favoritos: [idMineiro, idSushi, idPizzaria]
  },
  {
    nome: "Daniel Santos",
    email: "daniel@email.com",
    telefone: "42999004004",
    enderecos: [
      { rua: "Rua XV de Novembro", numero: 300, cidade: "Guarapuava", cep: "85010-700", principal: true },
      { rua: "Rua Tiradentes", numero: 90, cidade: "Guarapuava", cep: "85010-800", principal: false }
    ],
    favoritos: [idBurger, idTaco]
  },
  {
    nome: "Elena Ferreira",
    email: "elena@email.com",
    telefone: "42999005005",
    enderecos: [
      { rua: "Rua Cruz Machado", numero: 150, cidade: "Guarapuava", cep: "85010-900", principal: true }
    ],
    favoritos: []
  },
  {
    nome: "Felipe Lima",
    email: "felipe@email.com",
    telefone: "42999006006",
    enderecos: [
      { rua: "Rua Barão do Cerro Azul", numero: 400, cidade: "Guarapuava", cep: "85011-000", principal: true }
    ],
    favoritos: [idSushi]
  }
]);

const clientes = db.clientes.find().toArray();
const idAna = clientes[0]._id;
const idBruno = clientes[1]._id;
const idCarla = clientes[2]._id;
const idDaniel = clientes[3]._id;
const idElena = clientes[4]._id;
const idFelipe = clientes[5]._id;

// ========================================
// Coleção: pedidos
// ========================================
db.pedidos.insertMany([
  {
    cliente_id: idAna,
    restaurante_id: idSushi,
    itens: [
      { nome: "Combo Sashimi", quantidade: 1, preco_unitario: 69.90 },
      { nome: "Temaki Salmão", quantidade: 2, preco_unitario: 28.90 }
    ],
    valor_total: 127.70, status: "entregue",
    data: new Date("2026-03-15T19:30:00"),
    entrega: { endereco: "Rua Guaíra, 200", previsao: "45min", entregador: "João" }
  },
  {
    cliente_id: idAna, restaurante_id: idBurger,
    itens: [
      { nome: "Classic Burger", quantidade: 2, preco_unitario: 32.90 },
      { nome: "Batata Frita G", quantidade: 1, preco_unitario: 18.90 }
    ],
    valor_total: 84.70, status: "entregue",
    data: new Date("2026-03-17T20:00:00"),
    entrega: { endereco: "Rua Guaíra, 200", previsao: "30min", entregador: "Maria" }
  },
  {
    cliente_id: idBruno, restaurante_id: idPizzaria,
    itens: [
      { nome: "Pizza Margherita", quantidade: 1, preco_unitario: 45.90 },
      { nome: "Pizza Calabresa", quantidade: 1, preco_unitario: 42.90 }
    ],
    valor_total: 88.80, status: "entregue",
    data: new Date("2026-03-16T21:00:00"),
    entrega: { endereco: "Av. Manoel Ribas, 1500", previsao: "40min", entregador: "João" }
  },
  {
    cliente_id: idCarla, restaurante_id: idMineiro,
    itens: [
      { nome: "Prato Feito", quantidade: 2, preco_unitario: 24.90 },
      { nome: "Pão de Queijo (10un)", quantidade: 1, preco_unitario: 15.90 }
    ],
    valor_total: 65.70, status: "entregue",
    data: new Date("2026-03-18T12:00:00"),
    entrega: { endereco: "Rua Saldanha Marinho, 800", previsao: "25min", entregador: "Pedro" }
  },
  {
    cliente_id: idCarla, restaurante_id: idSushi,
    itens: [
      { nome: "Hot Roll", quantidade: 2, preco_unitario: 32.90 }
    ],
    valor_total: 65.80, status: "enviado",
    data: new Date("2026-03-20T19:45:00"),
    entrega: { endereco: "Rua Saldanha Marinho, 800", previsao: "40min", entregador: "Maria" }
  },
  {
    cliente_id: idDaniel, restaurante_id: idBurger,
    itens: [
      { nome: "Smash Burger", quantidade: 3, preco_unitario: 36.90 },
      { nome: "Batata Frita G", quantidade: 2, preco_unitario: 18.90 }
    ],
    valor_total: 148.50, status: "entregue",
    data: new Date("2026-03-19T20:30:00"),
    entrega: { endereco: "Rua XV de Novembro, 300", previsao: "35min", entregador: "João" }
  },
  {
    cliente_id: idDaniel, restaurante_id: idTaco,
    itens: [
      { nome: "Burrito Frango", quantidade: 2, preco_unitario: 28.90 },
      { nome: "Nachos Supreme", quantidade: 1, preco_unitario: 34.90 }
    ],
    valor_total: 92.70, status: "preparando",
    data: new Date("2026-03-21T13:00:00"),
    entrega: { endereco: "Rua XV de Novembro, 300", previsao: "30min", entregador: null }
  },
  {
    cliente_id: idElena, restaurante_id: idPizzaria,
    itens: [
      { nome: "Pizza Margherita", quantidade: 1, preco_unitario: 45.90 }
    ],
    valor_total: 45.90, status: "pendente",
    data: new Date("2026-03-21T19:00:00"),
    entrega: { endereco: "Rua Cruz Machado, 150", previsao: "40min", entregador: null }
  },
  {
    cliente_id: idFelipe, restaurante_id: idSushi,
    itens: [
      { nome: "Combo Sashimi", quantidade: 1, preco_unitario: 69.90 },
      { nome: "Hot Roll", quantidade: 1, preco_unitario: 32.90 }
    ],
    valor_total: 102.80, status: "entregue",
    data: new Date("2026-03-14T20:00:00"),
    entrega: { endereco: "Rua Barão do Cerro Azul, 400", previsao: "45min", entregador: "Pedro" }
  },
  {
    cliente_id: idAna, restaurante_id: idMineiro,
    itens: [
      { nome: "Frango com Quiabo", quantidade: 1, preco_unitario: 29.90 },
      { nome: "Pão de Queijo (10un)", quantidade: 2, preco_unitario: 15.90 }
    ],
    valor_total: 61.70, status: "entregue",
    data: new Date("2026-03-20T12:30:00"),
    entrega: { endereco: "Rua Ponta Grossa, 50", previsao: "20min", entregador: "Maria" }
  }
]);

// ========================================
// Coleção: avaliacoes
// ========================================
db.avaliacoes.insertMany([
  { cliente_id: idAna, restaurante_id: idSushi, nota: 5, comentario: "Sashimi impecável, super fresco!", data: new Date("2026-03-15T21:00:00"), resposta_restaurante: "Obrigado, Ana! Volte sempre!" },
  { cliente_id: idAna, restaurante_id: idBurger, nota: 4, comentario: "Burger muito bom, mas a batata chegou fria.", data: new Date("2026-03-17T21:30:00"), resposta_restaurante: null },
  { cliente_id: idBruno, restaurante_id: idPizzaria, nota: 5, comentario: "Melhor pizza da cidade!", data: new Date("2026-03-16T22:00:00"), resposta_restaurante: "Gratidão, Bruno!" },
  { cliente_id: idCarla, restaurante_id: idMineiro, nota: 5, comentario: "Comida caseira de verdade. Feijão maravilhoso.", data: new Date("2026-03-18T14:00:00"), resposta_restaurante: "Que bom que gostou, Carla!" },
  { cliente_id: idCarla, restaurante_id: idSushi, nota: 4, comentario: "Hot roll crocante, mas demorou um pouco.", data: new Date("2026-03-20T21:00:00"), resposta_restaurante: null },
  { cliente_id: idDaniel, restaurante_id: idBurger, nota: 5, comentario: "Smash burger sensacional. Pedi 3 e não me arrependi.", data: new Date("2026-03-19T22:00:00"), resposta_restaurante: "Valeu, Daniel! Desafio aceito na próxima!" },
  { cliente_id: idDaniel, restaurante_id: idTaco, nota: 3, comentario: "Burrito bom, mas nachos vieram murchos.", data: new Date("2026-03-21T15:00:00"), resposta_restaurante: null },
  { cliente_id: idFelipe, restaurante_id: idSushi, nota: 5, comentario: "Combo sashimi excelente. Recomendo muito.", data: new Date("2026-03-14T22:00:00"), resposta_restaurante: "Obrigado, Felipe!" },
  { cliente_id: idAna, restaurante_id: idMineiro, nota: 4, comentario: "Frango com quiabo muito gostoso, pão de queijo perfeito.", data: new Date("2026-03-20T14:00:00"), resposta_restaurante: null },
  { cliente_id: idBruno, restaurante_id: idSushi, nota: 4, comentario: "Temaki bom, mas porção poderia ser maior.", data: new Date("2026-03-18T20:30:00"), resposta_restaurante: "Vamos avaliar, Bruno! Obrigado pelo feedback." }
]);

// ========================================
// Coleção Simples: itens (para início rápido e testes)
// ========================================
db.itens.insertMany([
  { nome: "Pizza Margherita", categoria: "Pizzas", preco: 45.90, tags: ["italiana", "queijo"] },
  { nome: "Combo Sashimi", categoria: "Japonesa", preco: 69.90, tags: ["peixe", "fresco"] },
  { nome: "Classic Burger", categoria: "Burgers", preco: 32.90, tags: ["artesanal", "carne"] },
  { nome: "Taco de Carne", categoria: "Mexicana", preco: 19.90, tags: ["crocante", "picante"] },
  { nome: "Prato Feito Mineiro", categoria: "Brasileira", preco: 24.90, tags: ["caseira", "completo"] }
]);

print("=== GastroHub inicializado com sucesso! ===");
print("Itens (coleção simples): " + db.itens.countDocuments());
print("Restaurantes: " + db.restaurantes.countDocuments());
print("Itens cardápio: " + db.cardapio.countDocuments());
print("Clientes: " + db.clientes.countDocuments());
print("Pedidos: " + db.pedidos.countDocuments());
print("Avaliações: " + db.avaliacoes.countDocuments());
