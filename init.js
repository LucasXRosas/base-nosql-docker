/**
 * ============================================================================
 * MONGODB SCRIPT — RETROVAULT (CHECKPOINT 1)
 * E-commerce de Mídias Físicas de Jogos
 * ============================================================================
 */

db = db.getSiblingDB("retrovault");

// ── 1. Categorias ───────────────────────────────────────────────────────────
db.categorias.drop();
db.categorias.createIndex({ "slug": 1 }, { unique: true });
db.categorias.createIndex({ "nome": 1 });
db.categorias.createIndex({ "ativa": 1 });

db.categorias.insertMany([
  {
    nome: "Survival Horror",
    slug: "survival-horror",
    descricao: "Jogos com foco em sobrevivência, recursos escassos e tensão atmosférica.",
    ativa: true
  },
  {
    nome: "RPG",
    slug: "rpg",
    descricao: "Role-Playing Games com foco em progressão de personagem, narrativa rica e exploração.",
    ativa: true
  },
  {
    nome: "Ação e Aventura",
    slug: "acao-e-aventura",
    descricao: "Jogos que combinam combates dinâmicos, resolução de quebra-cabeças e enredos imersivos.",
    ativa: true
  },
  {
    nome: "Plataforma",
    slug: "plataforma",
    descricao: "Clássicos e contemporâneos de pulo e progressão por fases de precisão.",
    ativa: true
  },
  {
    nome: "Luta",
    slug: "luta",
    descricao: "Disputas competitivas 1v1 ou em equipes com mecânicas avançadas de combate.",
    ativa: true
  },
  {
    nome: "Corrida e Simulação",
    slug: "corrida-e-simulacao",
    descricao: "Mídias de simulação automobilística de alta precisão e competições de velocidade.",
    ativa: true
  }
]);

const catSurvival = db.categorias.findOne({ slug: "survival-horror" })._id;
const catRPG = db.categorias.findOne({ slug: "rpg" })._id;
const catAcao = db.categorias.findOne({ slug: "acao-e-aventura" })._id;
const catPlataforma = db.categorias.findOne({ slug: "plataforma" })._id;
const catLuta = db.categorias.findOne({ slug: "luta" })._id;
const catCorrida = db.categorias.findOne({ slug: "corrida-e-simulacao" })._id;

const fornRetroWorld = new ObjectId("65f89a559f1b2c001c8e4010");
const fornClassicGames = new ObjectId("65f89a559f1b2c001c8e4011");
const fornGamerVault = new ObjectId("65f89a559f1b2c001c8e4012");

// ── 2. Jogos ────────────────────────────────────────────────────────────────
db.jogos.drop();
db.jogos.createIndex({ "sku": 1 }, { unique: true });
db.jogos.createIndex({ "categoria_id": 1 });
db.jogos.createIndex({ "plataforma": 1 });
db.jogos.createIndex({ "tags": 1 });
db.jogos.createIndex({ "preco": 1 });
db.jogos.createIndex({ "avaliacoes_resumo.media_nota": -1 });
db.jogos.createIndex({ "ativo": 1 });

db.jogos.insertMany([
  {
    _id: new ObjectId("65f8a12b9f1b2c001c8e4a01"),
    sku: "GAME-PS4-TLOUP1-001",
    titulo: "The Last of Us Part I - Edição de Colecionador",
    descricao: "Jogo em mídia física para PS4 em perfeito estado de conservação, incluindo luva metálica e encartes originais.",
    preco: 249.90,
    quantidade_estoque: 15,
    ativo: true,
    data_cadastramento: new Date("2026-03-01T10:30:00Z"),
    categoria_id: catSurvival,
    fornecedor_id: fornRetroWorld,
    plataforma: "PlayStation 4",
    tags: ["ps4", "exclusivo", "survival-horror", "seminovo", "midia-fisica"],
    especificacoes_midia: {
      condicao: "Seminovo",
      estado_disco: "Excelente (Sem riscos)",
      possui_caixa_original: true,
      possui_manual: true,
      regiao: "NTSC-U",
      ano_lancamento: 2014
    },
    dimensoes_embalagem: {
      altura_cm: 17.0,
      largura_cm: 13.5,
      profundidade_cm: 1.5,
      peso_gramas: 180
    },
    avaliacoes_resumo: {
      media_nota: 4.9,
      total_avaliacoes: 42
    }
  },
  {
    _id: new ObjectId("65f8a12b9f1b2c001c8e4a02"),
    sku: "GAME-PS2-SH2-002",
    titulo: "Silent Hill 2 - Black Label Original",
    descricao: "Clássico seminal do terror psicológico no PlayStation 2. Item de colecionador impecável.",
    preco: 380.00,
    quantidade_estoque: 3,
    ativo: true,
    data_cadastramento: new Date("2026-02-15T14:00:00Z"),
    categoria_id: catSurvival,
    fornecedor_id: fornClassicGames,
    plataforma: "PlayStation 2",
    tags: ["ps2", "classico", "survival-horror", "raridade", "konami"],
    especificacoes_midia: {
      condicao: "Seminovo",
      estado_disco: "Perfeito (Polimento de fábrica)",
      possui_caixa_original: true,
      possui_manual: true,
      regiao: "NTSC-U",
      ano_lancamento: 2001
    },
    dimensoes_embalagem: {
      altura_cm: 19.0,
      largura_cm: 13.5,
      profundidade_cm: 1.5,
      peso_gramas: 160
    },
    avaliacoes_resumo: {
      media_nota: 4.95,
      total_avaliacoes: 38
    }
  },
  {
    _id: new ObjectId("65f8a12b9f1b2c001c8e4a03"),
    sku: "GAME-GC-RE4-003",
    titulo: "Resident Evil 4 - Versão GameCube 2 Discos",
    descricao: "Edição definitiva original em 2 mini-DVDs no GameCube. Caixa original vermelha.",
    preco: 140.00,
    quantidade_estoque: 8,
    ativo: true,
    data_cadastramento: new Date("2026-02-20T11:00:00Z"),
    categoria_id: catSurvival,
    fornecedor_id: fornRetroWorld,
    plataforma: "Nintendo GameCube",
    tags: ["gamecube", "resident-evil", "survival-horror", "promocao"],
    especificacoes_midia: {
      condicao: "Usado",
      estado_disco: "Muito Bom (Micro marcas de uso)",
      possui_caixa_original: true,
      possui_manual: true,
      regiao: "NTSC-U",
      ano_lancamento: 2005
    },
    dimensoes_embalagem: {
      altura_cm: 15.0,
      largura_cm: 13.5,
      profundidade_cm: 1.5,
      peso_gramas: 150
    },
    avaliacoes_resumo: {
      media_nota: 4.8,
      total_avaliacoes: 55
    }
  },
  {
    _id: new ObjectId("65f8a12b9f1b2c001c8e4a04"),
    sku: "GAME-NSW-TOTK-004",
    titulo: "The Legend of Zelda: Tears of the Kingdom",
    descricao: "Cartucho original para Nintendo Switch, lacrado de fábrica com selo nacional.",
    preco: 299.00,
    quantidade_estoque: 20,
    ativo: true,
    data_cadastramento: new Date("2026-03-05T09:00:00Z"),
    categoria_id: catAcao,
    fornecedor_id: fornGamerVault,
    plataforma: "Nintendo Switch",
    tags: ["switch", "zelda", "nintendo", "lacrado", "rpg", "aventura"],
    especificacoes_midia: {
      condicao: "Lacre de Fábrica",
      estado_disco: "Novo",
      possui_caixa_original: true,
      possui_manual: false,
      regiao: "NTSC-U",
      ano_lancamento: 2023
    },
    dimensoes_embalagem: {
      altura_cm: 16.5,
      largura_cm: 10.5,
      profundidade_cm: 1.2,
      peso_gramas: 60
    },
    avaliacoes_resumo: {
      media_nota: 4.95,
      total_avaliacoes: 85
    }
  },
  {
    _id: new ObjectId("65f8a12b9f1b2c001c8e4a05"),
    sku: "GAME-NSW-SMO-005",
    titulo: "Super Mario Odyssey",
    descricao: "Aventura em 3D espetacular do bigodudo pelo mundo aberto de Metro City e além.",
    preco: 199.90,
    quantidade_estoque: 12,
    ativo: true,
    data_cadastramento: new Date("2026-01-18T16:00:00Z"),
    categoria_id: catPlataforma,
    fornecedor_id: fornGamerVault,
    plataforma: "Nintendo Switch",
    tags: ["switch", "mario", "plataforma", "nintendo", "seminovo"],
    especificacoes_midia: {
      condicao: "Seminovo",
      estado_disco: "Perfeito",
      possui_caixa_original: true,
      possui_manual: false,
      regiao: "NTSC-U",
      ano_lancamento: 2017
    },
    dimensoes_embalagem: {
      altura_cm: 16.5,
      largura_cm: 10.5,
      profundidade_cm: 1.2,
      peso_gramas: 60
    },
    avaliacoes_resumo: {
      media_nota: 4.7,
      total_avaliacoes: 40
    }
  },
  {
    _id: new ObjectId("65f8a12b9f1b2c001c8e4a06"),
    sku: "GAME-SNES-CT-006",
    titulo: "Chrono Trigger - Cartucho Original Japonês Completo",
    descricao: "Obra-prima dos RPGs no Super Nintendo com caixa, berço, manuais e mapa intactos.",
    preco: 890.00,
    quantidade_estoque: 2,
    ativo: true,
    data_cadastramento: new Date("2026-02-01T12:00:00Z"),
    categoria_id: catRPG,
    fornecedor_id: fornClassicGames,
    plataforma: "Super Nintendo",
    tags: ["snes", "rpg", "squaresoft", "raridade", "completo"],
    especificacoes_midia: {
      condicao: "Seminovo",
      estado_disco: "Excelente (Pinos limpos e bateria nova)",
      possui_caixa_original: true,
      possui_manual: true,
      regiao: "NTSC-J",
      ano_lancamento: 1995
    },
    dimensoes_embalagem: {
      altura_cm: 19.5,
      largura_cm: 12.5,
      profundidade_cm: 3.0,
      peso_gramas: 280
    },
    avaliacoes_resumo: {
      media_nota: 5.0,
      total_avaliacoes: 92
    }
  },
  {
    _id: new ObjectId("65f8a12b9f1b2c001c8e4a07"),
    sku: "GAME-PS2-GT4-007",
    titulo: "Gran Turismo 4 - The Real Driving Simulator",
    descricao: "Mídia física com centenas de carros escaneados e circuitos realistas no PS2.",
    preco: 95.00,
    quantidade_estoque: 10,
    ativo: true,
    data_cadastramento: new Date("2026-03-02T13:45:00Z"),
    categoria_id: catCorrida,
    fornecedor_id: fornRetroWorld,
    plataforma: "PlayStation 2",
    tags: ["ps2", "corrida", "simulador", "promocao", "sony"],
    especificacoes_midia: {
      condicao: "Usado",
      estado_disco: "Bom (Leves marcas superficiais)",
      possui_caixa_original: true,
      possui_manual: true,
      regiao: "NTSC-U",
      ano_lancamento: 2004
    },
    dimensoes_embalagem: {
      altura_cm: 19.0,
      largura_cm: 13.5,
      profundidade_cm: 1.5,
      peso_gramas: 170
    },
    avaliacoes_resumo: {
      media_nota: 4.4,
      total_avaliacoes: 25
    }
  },
  {
    _id: new ObjectId("65f8a12b9f1b2c001c8e4a08"),
    sku: "GAME-SNES-SF2T-008",
    titulo: "Street Fighter II Turbo",
    descricao: "Cartucho clássico de luta para SNES. Label original brilhante sem desgastes.",
    preco: 135.00,
    quantidade_estoque: 5,
    ativo: true,
    data_cadastramento: new Date("2026-02-28T18:00:00Z"),
    categoria_id: catLuta,
    fornecedor_id: fornClassicGames,
    plataforma: "Super Nintendo",
    tags: ["snes", "luta", "capcom", "promocao", "retro"],
    especificacoes_midia: {
      condicao: "Usado",
      estado_disco: "Muito Bom",
      possui_caixa_original: false,
      possui_manual: false,
      regiao: "NTSC-U",
      ano_lancamento: 1993
    },
    dimensoes_embalagem: {
      altura_cm: 14.0,
      largura_cm: 8.5,
      profundidade_cm: 2.0,
      peso_gramas: 120
    },
    avaliacoes_resumo: {
      media_nota: 4.6,
      total_avaliacoes: 30
    }
  },
  {
    _id: new ObjectId("65f8a12b9f1b2c001c8e4a09"),
    sku: "GAME-PS4-DSR-009",
    titulo: "Dark Souls Remastered",
    descricao: "Reviva o clássico do desafio e atmosfera sombria em 60 FPS com expansão inclusa.",
    preco: 120.00,
    quantidade_estoque: 14,
    ativo: true,
    data_cadastramento: new Date("2026-03-08T15:30:00Z"),
    categoria_id: catRPG,
    fornecedor_id: fornRetroWorld,
    plataforma: "PlayStation 4",
    tags: ["ps4", "souls", "fromsoftware", "rpg", "promocao"],
    especificacoes_midia: {
      condicao: "Seminovo",
      estado_disco: "Excelente",
      possui_caixa_original: true,
      possui_manual: false,
      regiao: "NTSC-U",
      ano_lancamento: 2018
    },
    dimensoes_embalagem: {
      altura_cm: 17.0,
      largura_cm: 13.5,
      profundidade_cm: 1.5,
      peso_gramas: 160
    },
    avaliacoes_resumo: {
      media_nota: 4.65,
      total_avaliacoes: 34
    }
  },
  {
    _id: new ObjectId("65f8a12b9f1b2c001c8e4a10"),
    sku: "GAME-PS4-GOW-010",
    titulo: "God of War (PlayStation Hits)",
    descricao: "Jornada nórdica épica de Kratos e Atreus. Mídia nacional em caixa azul.",
    preco: 89.90,
    quantidade_estoque: 25,
    ativo: true,
    data_cadastramento: new Date("2026-03-10T11:00:00Z"),
    categoria_id: catAcao,
    fornecedor_id: fornRetroWorld,
    plataforma: "PlayStation 4",
    tags: ["ps4", "kratos", "acao", "exclusivo", "promocao"],
    especificacoes_midia: {
      condicao: "Seminovo",
      estado_disco: "Excelente",
      possui_caixa_original: true,
      possui_manual: true,
      regiao: "NTSC-U",
      ano_lancamento: 2018
    },
    dimensoes_embalagem: {
      altura_cm: 17.0,
      largura_cm: 13.5,
      profundidade_cm: 1.5,
      peso_gramas: 170
    },
    avaliacoes_resumo: {
      media_nota: 4.85,
      total_avaliacoes: 95
    }
  },
  {
    _id: new ObjectId("65f8a12b9f1b2c001c8e4a11"),
    sku: "GAME-PS5-ER-011",
    titulo: "Elden Ring - Launch Edition Mídia Física",
    descricao: "Mídia física lacrada de PS5 com cards colecionáveis, pôster e adesivos originais.",
    preco: 219.00,
    quantidade_estoque: 18,
    ativo: true,
    data_cadastramento: new Date("2026-02-25T17:00:00Z"),
    categoria_id: catRPG,
    fornecedor_id: fornGamerVault,
    plataforma: "PlayStation 5",
    tags: ["ps5", "goty", "rpg", "fromsoftware", "lacrado"],
    especificacoes_midia: {
      condicao: "Lacre de Fábrica",
      estado_disco: "Novo",
      possui_caixa_original: true,
      possui_manual: true,
      regiao: "NTSC-U",
      ano_lancamento: 2022
    },
    dimensoes_embalagem: {
      altura_cm: 17.0,
      largura_cm: 13.5,
      profundidade_cm: 1.5,
      peso_gramas: 190
    },
    avaliacoes_resumo: {
      media_nota: 4.95,
      total_avaliacoes: 110
    }
  },
  {
    _id: new ObjectId("65f8a12b9f1b2c001c8e4a12"),
    sku: "GAME-PS2-MGS3-012",
    titulo: "Metal Gear Solid 3: Snake Eater",
    descricao: "Obra prima de Hideo Kojima com sobrevivência na selva Soviética durante a Guerra Fria.",
    preco: 145.00,
    quantidade_estoque: 6,
    ativo: true,
    data_cadastramento: new Date("2026-03-04T10:00:00Z"),
    categoria_id: catAcao,
    fornecedor_id: fornClassicGames,
    plataforma: "PlayStation 2",
    tags: ["ps2", "stealth", "kojima", "acao", "promocao"],
    especificacoes_midia: {
      condicao: "Seminovo",
      estado_disco: "Excelente",
      possui_caixa_original: true,
      possui_manual: true,
      regiao: "NTSC-U",
      ano_lancamento: 2004
    },
    dimensoes_embalagem: {
      altura_cm: 19.0,
      largura_cm: 13.5,
      profundidade_cm: 1.5,
      peso_gramas: 160
    },
    avaliacoes_resumo: {
      media_nota: 4.9,
      total_avaliacoes: 50
    }
  }
]);

const idTLoU = new ObjectId("65f8a12b9f1b2c001c8e4a01");
const idSH2 = new ObjectId("65f8a12b9f1b2c001c8e4a02");
const idRE4 = new ObjectId("65f8a12b9f1b2c001c8e4a03");
const idTOTK = new ObjectId("65f8a12b9f1b2c001c8e4a04");
const idMario = new ObjectId("65f8a12b9f1b2c001c8e4a05");
const idChrono = new ObjectId("65f8a12b9f1b2c001c8e4a06");
const idGT4 = new ObjectId("65f8a12b9f1b2c001c8e4a07");
const idSF2 = new ObjectId("65f8a12b9f1b2c001c8e4a08");
const idGoW = new ObjectId("65f8a12b9f1b2c001c8e4a10");

// ── 3. Clientes ─────────────────────────────────────────────────────────────
db.clientes.drop();
db.clientes.createIndex({ "email": 1 }, { unique: true });
db.clientes.createIndex({ "telefone": 1 });

db.clientes.insertMany([
  {
    _id: new ObjectId("65f8c0009f1b2c001c8e5001"),
    nome: "Lucas Rosa",
    email: "lucas.rosa@email.com",
    telefone: "42999887766",
    enderecos: [
      {
        rua: "Rua XV de Novembro",
        numero: 1500,
        cidade: "Guarapuava",
        cep: "85010-000",
        principal: true
      },
      {
        rua: "Av. Moacir Julio Silvestri",
        numero: 320,
        cidade: "Guarapuava",
        cep: "85015-200",
        principal: false
      }
    ],
    desejos: [idTLoU, idSH2, idChrono]
  },
  {
    _id: new ObjectId("65f8c0009f1b2c001c8e5002"),
    nome: "Ana Silva",
    email: "ana.silva@email.com",
    telefone: "42999001001",
    enderecos: [
      {
        rua: "Rua Guaíra",
        numero: 200,
        cidade: "Guarapuava",
        cep: "85015-000",
        principal: true
      }
    ],
    desejos: [idTOTK, idMario]
  },
  {
    _id: new ObjectId("65f8c0009f1b2c001c8e5003"),
    nome: "Carlos Eduardo",
    email: "carlos.eduardo@email.com",
    telefone: "42999002002",
    enderecos: [
      {
        rua: "Rua Saldanha Marinho",
        numero: 800,
        cidade: "Guarapuava",
        cep: "85010-300",
        principal: true
      }
    ],
    desejos: [idRE4, idGoW]
  },
  {
    _id: new ObjectId("65f8c0009f1b2c001c8e5004"),
    nome: "Mariana Souza",
    email: "mariana.souza@email.com",
    telefone: "42999003003",
    enderecos: [
      {
        rua: "Rua Vicente Machado",
        numero: 950,
        cidade: "Guarapuava",
        cep: "85010-400",
        principal: true
      }
    ],
    desejos: [idGT4, idSF2]
  }
]);

const idCliLucas = new ObjectId("65f8c0009f1b2c001c8e5001");
const idCliAna = new ObjectId("65f8c0009f1b2c001c8e5002");
const idCliCarlos = new ObjectId("65f8c0009f1b2c001c8e5003");
const idCliMariana = new ObjectId("65f8c0009f1b2c001c8e5004");

// ── 4. Pedidos ──────────────────────────────────────────────────────────────
db.pedidos.drop();
db.pedidos.createIndex({ "cliente_id": 1 });
db.pedidos.createIndex({ "status": 1 });
db.pedidos.createIndex({ "data_pedido": 1 });
db.pedidos.createIndex({ "itens.jogo_id": 1 });

db.pedidos.insertMany([
  {
    _id: new ObjectId("65f8d1119f1b2c001c8e6001"),
    cliente_id: idCliLucas,
    itens: [
      {
        jogo_id: idTLoU,
        titulo: "The Last of Us Part I - Edição de Colecionador",
        plataforma: "PlayStation 4",
        quantidade: 1,
        preco_unitario: 249.90
      }
    ],
    valor_total: 269.90,
    status: "pago",
    data_pedido: new Date("2026-09-10T14:20:00Z"),
    entrega: {
      endereco_completo: "Rua XV de Novembro, 1500 - Centro, Guarapuava-PR, CEP 85010-000",
      codigo_rastreio: null,
      valor_frete: 20.00
    }
  },
  {
    _id: new ObjectId("65f8d1119f1b2c001c8e6002"),
    cliente_id: idCliAna,
    itens: [
      {
        jogo_id: idRE4,
        titulo: "Resident Evil 4 - Versão GameCube 2 Discos",
        plataforma: "Nintendo GameCube",
        quantidade: 1,
        preco_unitario: 140.00
      }
    ],
    valor_total: 158.00,
    status: "em_separacao",
    data_pedido: new Date("2026-09-11T09:15:00Z"),
    entrega: {
      endereco_completo: "Rua Guaíra, 200 - Boqueirão, Guarapuava-PR, CEP 85015-000",
      codigo_rastreio: null,
      valor_frete: 18.00
    }
  },
  {
    _id: new ObjectId("65f8d1119f1b2c001c8e6003"),
    cliente_id: idCliCarlos,
    itens: [
      {
        jogo_id: idSH2,
        titulo: "Silent Hill 2 - Black Label Original",
        plataforma: "PlayStation 2",
        quantidade: 1,
        preco_unitario: 380.00
      },
      {
        jogo_id: idSF2,
        titulo: "Street Fighter II Turbo",
        plataforma: "Super Nintendo",
        quantidade: 1,
        preco_unitario: 135.00
      }
    ],
    valor_total: 540.00,
    status: "pago",
    data_pedido: new Date("2026-09-11T16:40:00Z"),
    entrega: {
      endereco_completo: "Rua Saldanha Marinho, 800 - Batel, Guarapuava-PR, CEP 85010-300",
      codigo_rastreio: null,
      valor_frete: 25.00
    }
  },
  {
    _id: new ObjectId("65f8d1119f1b2c001c8e6004"),
    cliente_id: idCliMariana,
    itens: [
      {
        jogo_id: idMario,
        titulo: "Super Mario Odyssey",
        plataforma: "Nintendo Switch",
        quantidade: 1,
        preco_unitario: 199.90
      }
    ],
    valor_total: 214.90,
    status: "enviado",
    data_pedido: new Date("2026-09-08T11:00:00Z"),
    entrega: {
      endereco_completo: "Rua Vicente Machado, 950 - Centro, Guarapuava-PR, CEP 85010-400",
      codigo_rastreio: "AA123456789BR",
      valor_frete: 15.00
    }
  },
  {
    _id: new ObjectId("65f8d1119f1b2c001c8e6005"),
    cliente_id: idCliLucas,
    itens: [
      {
        jogo_id: idGoW,
        titulo: "God of War (PlayStation Hits)",
        plataforma: "PlayStation 4",
        quantidade: 1,
        preco_unitario: 89.90
      }
    ],
    valor_total: 104.90,
    status: "entregue",
    data_pedido: new Date("2026-09-02T10:15:00Z"),
    entrega: {
      endereco_completo: "Rua XV de Novembro, 1500 - Centro, Guarapuava-PR, CEP 85010-000",
      codigo_rastreio: "QB987654321BR",
      valor_frete: 15.00
    }
  },
  {
    _id: new ObjectId("65f8d1119f1b2c001c8e6006"),
    cliente_id: idCliAna,
    itens: [
      {
        jogo_id: idChrono,
        titulo: "Chrono Trigger - Cartucho Original Japonês Completo",
        plataforma: "Super Nintendo",
        quantidade: 1,
        preco_unitario: 890.00
      }
    ],
    valor_total: 920.00,
    status: "pendente",
    data_pedido: new Date("2026-09-12T20:00:00Z"),
    entrega: {
      endereco_completo: "Rua Guaíra, 200 - Boqueirão, Guarapuava-PR, CEP 85015-000",
      codigo_rastreio: null,
      valor_frete: 30.00
    }
  }
]);

print("=== [MongoDB] RetroVault inicializado com sucesso! ===");
print("Categorias: " + db.categorias.countDocuments());
print("Jogos:      " + db.jogos.countDocuments());
print("Clientes:   " + db.clientes.countDocuments());
print("Pedidos:    " + db.pedidos.countDocuments());
