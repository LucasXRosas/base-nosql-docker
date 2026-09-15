/**
 * ============================================================================
 * MONGODB INITIALIZATION SCRIPT — RETROVAULT (CHECKPOINT 1)
 * E-commerce de Mídias Físicas de Jogos
 * ============================================================================
 * 
 * Executado automaticamente na primeira inicialização do MongoDB pelo container.
 * Configura:
 * 1. Banco de dados: retrovault
 * 2. Coleções principais: categorias, jogos, clientes, pedidos
 * 3. Criação de índices de unicidade, performance e multikey
 * 4. Carga inicial de dados realistas e estruturados conforme o CHECKPOINT_1.md
 *    (Mínimo de 20 documentos na coleção principal de jogos + categorias, clientes e pedidos)
 */

db = db.getSiblingDB("retrovault");

// ── 1. COLEÇÃO: categorias ──────────────────────────────────────────────────
db.createCollection("categorias");
db.categorias.createIndex({ "slug": 1 }, { unique: true });
db.categorias.createIndex({ "nome": 1 });
db.categorias.createIndex({ "ativa": 1 });

const catSurvivalId = new ObjectId("65f8999f9f1b2c001c8e4000");
const catRPGId = new ObjectId("65f8999f9f1b2c001c8e4001");
const catAcaoId = new ObjectId("65f8999f9f1b2c001c8e4002");
const catPlataformaId = new ObjectId("65f8999f9f1b2c001c8e4003");
const catLutaId = new ObjectId("65f8999f9f1b2c001c8e4004");
const catCorridaId = new ObjectId("65f8999f9f1b2c001c8e4005");

db.categorias.insertMany([
  {
    _id: catSurvivalId,
    nome: "Survival Horror",
    slug: "survival-horror",
    descricao: "Jogos com foco em sobrevivência, recursos escassos e tensão atmosférica.",
    ativa: true
  },
  {
    _id: catRPGId,
    nome: "RPG",
    slug: "rpg",
    descricao: "Role-Playing Games com foco em progressão de personagem, narrativa rica e exploração.",
    ativa: true
  },
  {
    _id: catAcaoId,
    nome: "Ação e Aventura",
    slug: "acao-e-aventura",
    descricao: "Jogos que combinam combates dinâmicos, resolução de quebra-cabeças e enredos imersivos.",
    ativa: true
  },
  {
    _id: catPlataformaId,
    nome: "Plataforma",
    slug: "plataforma",
    descricao: "Clássicos e contemporâneos de pulo e progressão por fases de precisão.",
    ativa: true
  },
  {
    _id: catLutaId,
    nome: "Luta",
    slug: "luta",
    descricao: "Disputas competitivas 1v1 ou em equipes com mecânicas avançadas de combate.",
    ativa: true
  },
  {
    _id: catCorridaId,
    nome: "Corrida e Simulação",
    slug: "corrida-e-simulacao",
    descricao: "Mídias de simulação automobilística de alta precisão e competições de velocidade.",
    ativa: true
  }
]);

// Fornecedores de referência (Lojas parceiras e curadores certificados)
const fornRetroWorld = new ObjectId("65f89a559f1b2c001c8e4010");
const fornClassicGames = new ObjectId("65f89a559f1b2c001c8e4011");
const fornGamerVault = new ObjectId("65f89a559f1b2c001c8e4012");

// ── 2. COLEÇÃO: jogos (20 documentos no catálogo) ───────────────────────────
db.createCollection("jogos");
db.jogos.createIndex({ "sku": 1 }, { unique: true });
db.jogos.createIndex({ "categoria_id": 1 });
db.jogos.createIndex({ "plataforma": 1 });
db.jogos.createIndex({ "tags": 1 }); // Índice Multikey
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
    categoria_id: catSurvivalId,
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
    categoria_id: catSurvivalId,
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
    categoria_id: catSurvivalId,
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
    categoria_id: catAcaoId,
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
    categoria_id: catPlataformaId,
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
    categoria_id: catRPGId,
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
    categoria_id: catCorridaId,
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
    categoria_id: catLutaId,
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
    categoria_id: catRPGId,
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
    categoria_id: catAcaoId,
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
    categoria_id: catRPGId,
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
    categoria_id: catAcaoId,
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
  },
  {
    _id: new ObjectId("65f8a12b9f1b2c001c8e4a13"),
    sku: "GAME-PS1-SOTN-013",
    titulo: "Castlevania: Symphony of the Night",
    descricao: "O ápice do estilo Metroidvania no PS1. Disco duplo preto original sem arranhões.",
    preco: 420.00,
    quantidade_estoque: 4,
    ativo: true,
    data_cadastramento: new Date("2026-01-20T14:30:00Z"),
    categoria_id: catAcaoId,
    fornecedor_id: fornClassicGames,
    plataforma: "PlayStation",
    tags: ["ps1", "metroidvania", "castlevania", "raridade", "konami"],
    especificacoes_midia: {
      condicao: "Seminovo",
      estado_disco: "Excelente (Sem riscos)",
      possui_caixa_original: true,
      possui_manual: true,
      regiao: "NTSC-U",
      ano_lancamento: 1997
    },
    dimensoes_embalagem: {
      altura_cm: 14.2,
      largura_cm: 12.5,
      profundidade_cm: 1.0,
      peso_gramas: 140
    },
    avaliacoes_resumo: {
      media_nota: 4.98,
      total_avaliacoes: 75
    }
  },
  {
    _id: new ObjectId("65f8a12b9f1b2c001c8e4a14"),
    sku: "GAME-MD-SONIC2-014",
    titulo: "Sonic the Hedgehog 2",
    descricao: "Cartucho clássico do Mega Drive com a estreia de Miles Tails Prower. Label perfeita.",
    preco: 110.00,
    quantidade_estoque: 8,
    ativo: true,
    data_cadastramento: new Date("2026-02-10T09:45:00Z"),
    categoria_id: catPlataformaId,
    fornecedor_id: fornRetroWorld,
    plataforma: "Mega Drive",
    tags: ["megadrive", "sonic", "sega", "plataforma", "promocao"],
    especificacoes_midia: {
      condicao: "Usado",
      estado_disco: "Muito Bom",
      possui_caixa_original: true,
      possui_manual: false,
      regiao: "NTSC-U",
      ano_lancamento: 1992
    },
    dimensoes_embalagem: {
      altura_cm: 18.0,
      largura_cm: 13.0,
      profundidade_cm: 2.5,
      peso_gramas: 200
    },
    avaliacoes_resumo: {
      media_nota: 4.75,
      total_avaliacoes: 48
    }
  },
  {
    _id: new ObjectId("65f8a12b9f1b2c001c8e4a15"),
    sku: "GAME-GBA-POKE-015",
    titulo: "Pokémon Emerald Version",
    descricao: "Cartucho original verde translúcido para Game Boy Advance. Bateria de relógio trocada recentemente.",
    preco: 550.00,
    quantidade_estoque: 3,
    ativo: true,
    data_cadastramento: new Date("2026-02-18T18:20:00Z"),
    categoria_id: catRPGId,
    fornecedor_id: fornClassicGames,
    plataforma: "Game Boy Advance",
    tags: ["gba", "pokemon", "nintendo", "rpg", "raridade"],
    especificacoes_midia: {
      condicao: "Seminovo",
      estado_disco: "Excelente",
      possui_caixa_original: false,
      possui_manual: false,
      regiao: "NTSC-U",
      ano_lancamento: 2004
    },
    dimensoes_embalagem: {
      altura_cm: 6.0,
      largura_cm: 3.5,
      profundidade_cm: 1.0,
      peso_gramas: 40
    },
    avaliacoes_resumo: {
      media_nota: 4.92,
      total_avaliacoes: 64
    }
  },
  {
    _id: new ObjectId("65f8a12b9f1b2c001c8e4a16"),
    sku: "GAME-X360-H3-016",
    titulo: "Halo 3 - Edição Limitada em Lata Metal",
    descricao: "Caixa metálica de colecionador original para Xbox 360 com livro de arte dos Brutes.",
    preco: 125.00,
    quantidade_estoque: 11,
    ativo: true,
    data_cadastramento: new Date("2026-03-01T15:00:00Z"),
    categoria_id: catAcaoId,
    fornecedor_id: fornGamerVault,
    plataforma: "Xbox 360",
    tags: ["xbox360", "halo", "fps", "acao", "promocao"],
    especificacoes_midia: {
      condicao: "Seminovo",
      estado_disco: "Muito Bom",
      possui_caixa_original: true,
      possui_manual: true,
      regiao: "NTSC-U",
      ano_lancamento: 2007
    },
    dimensoes_embalagem: {
      altura_cm: 19.0,
      largura_cm: 13.5,
      profundidade_cm: 2.0,
      peso_gramas: 250
    },
    avaliacoes_resumo: {
      media_nota: 4.8,
      total_avaliacoes: 52
    }
  },
  {
    _id: new ObjectId("65f8a12b9f1b2c001c8e4a17"),
    sku: "GAME-PS1-RE2-017",
    titulo: "Resident Evil 2 - Versão Original 2 Discos",
    descricao: "Caixa dupla clássica com as campanhas lendárias de Leon S. Kennedy e Claire Redfield.",
    preco: 270.00,
    quantidade_estoque: 5,
    ativo: true,
    data_cadastramento: new Date("2026-02-22T13:10:00Z"),
    categoria_id: catSurvivalId,
    fornecedor_id: fornClassicGames,
    plataforma: "PlayStation",
    tags: ["ps1", "resident-evil", "survival-horror", "capcom"],
    especificacoes_midia: {
      condicao: "Seminovo",
      estado_disco: "Excelente",
      possui_caixa_original: true,
      possui_manual: true,
      regiao: "NTSC-U",
      ano_lancamento: 1998
    },
    dimensoes_embalagem: {
      altura_cm: 14.2,
      largura_cm: 12.5,
      profundidade_cm: 2.0,
      peso_gramas: 180
    },
    avaliacoes_resumo: {
      media_nota: 4.88,
      total_avaliacoes: 70
    }
  },
  {
    _id: new ObjectId("65f8a12b9f1b2c001c8e4a18"),
    sku: "GAME-PS1-FF7-018",
    titulo: "Final Fantasy VII - 3 Discos Original Black Label",
    descricao: "Edição norte-americana completa de um dos maiores clássicos da história dos games.",
    preco: 320.00,
    quantidade_estoque: 6,
    ativo: true,
    data_cadastramento: new Date("2026-01-25T11:00:00Z"),
    categoria_id: catRPGId,
    fornecedor_id: fornClassicGames,
    plataforma: "PlayStation",
    tags: ["ps1", "final-fantasy", "rpg", "squaresoft", "classico"],
    especificacoes_midia: {
      condicao: "Seminovo",
      estado_disco: "Excelente",
      possui_caixa_original: true,
      possui_manual: true,
      regiao: "NTSC-U",
      ano_lancamento: 1997
    },
    dimensoes_embalagem: {
      altura_cm: 14.2,
      largura_cm: 12.5,
      profundidade_cm: 2.5,
      peso_gramas: 210
    },
    avaliacoes_resumo: {
      media_nota: 4.95,
      total_avaliacoes: 98
    }
  },
  {
    _id: new ObjectId("65f8a12b9f1b2c001c8e4a19"),
    sku: "GAME-N64-ZELDA-019",
    titulo: "The Legend of Zelda: Ocarina of Time",
    descricao: "Cartucho cinza original do Nintendo 64. Bateria salvando perfeitamente e pinos higienizados.",
    preco: 350.00,
    quantidade_estoque: 4,
    ativo: true,
    data_cadastramento: new Date("2026-02-12T16:00:00Z"),
    categoria_id: catAcaoId,
    fornecedor_id: fornGamerVault,
    plataforma: "Nintendo 64",
    tags: ["n64", "zelda", "nintendo", "aventura", "goty"],
    especificacoes_midia: {
      condicao: "Seminovo",
      estado_disco: "Excelente",
      possui_caixa_original: false,
      possui_manual: true,
      regiao: "NTSC-U",
      ano_lancamento: 1998
    },
    dimensoes_embalagem: {
      altura_cm: 11.5,
      largura_cm: 7.5,
      profundidade_cm: 2.0,
      peso_gramas: 110
    },
    avaliacoes_resumo: {
      media_nota: 4.98,
      total_avaliacoes: 120
    }
  },
  {
    _id: new ObjectId("65f8a12b9f1b2c001c8e4a20"),
    sku: "GAME-GC-SSBM-020",
    titulo: "Super Smash Bros. Melee",
    descricao: "O jogo de luta mais influente e competitivo do GameCube. Encarte e mídia em ótimo estado.",
    preco: 260.00,
    quantidade_estoque: 7,
    ativo: true,
    data_cadastramento: new Date("2026-03-03T10:30:00Z"),
    categoria_id: catLutaId,
    fornecedor_id: fornRetroWorld,
    plataforma: "Nintendo GameCube",
    tags: ["gamecube", "smash", "luta", "nintendo", "competitivo"],
    especificacoes_midia: {
      condicao: "Seminovo",
      estado_disco: "Muito Bom",
      possui_caixa_original: true,
      possui_manual: true,
      regiao: "NTSC-U",
      ano_lancamento: 2001
    },
    dimensoes_embalagem: {
      altura_cm: 15.0,
      largura_cm: 13.5,
      profundidade_cm: 1.5,
      peso_gramas: 150
    },
    avaliacoes_resumo: {
      media_nota: 4.9,
      total_avaliacoes: 66
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
const idCastlevania = new ObjectId("65f8a12b9f1b2c001c8e4a13");
const idSonic2 = new ObjectId("65f8a12b9f1b2c001c8e4a14");

// ── 3. COLEÇÃO: clientes ────────────────────────────────────────────────────
db.createCollection("clientes");
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
    desejos: [idTLoU, idSH2, idChrono, idCastlevania]
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
    desejos: [idGT4, idSF2, idSonic2]
  },
  {
    _id: new ObjectId("65f8c0009f1b2c001c8e5005"),
    nome: "Juliana Prado",
    email: "juliana.prado@email.com",
    telefone: "42999004004",
    enderecos: [
      {
        rua: "Rua Brigadeiro Rocha",
        numero: 1200,
        cidade: "Guarapuava",
        cep: "85010-210",
        principal: true
      }
    ],
    desejos: [idCastlevania, idChrono]
  }
]);

const idCliLucas = new ObjectId("65f8c0009f1b2c001c8e5001");
const idCliAna = new ObjectId("65f8c0009f1b2c001c8e5002");
const idCliCarlos = new ObjectId("65f8c0009f1b2c001c8e5003");
const idCliMariana = new ObjectId("65f8c0009f1b2c001c8e5004");
const idCliJuliana = new ObjectId("65f8c0009f1b2c001c8e5005");

// ── 4. COLEÇÃO: pedidos ─────────────────────────────────────────────────────
db.createCollection("pedidos");
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
  },
  {
    _id: new ObjectId("65f8d1119f1b2c001c8e6007"),
    cliente_id: idCliJuliana,
    itens: [
      {
        jogo_id: idCastlevania,
        titulo: "Castlevania: Symphony of the Night",
        plataforma: "PlayStation",
        quantidade: 1,
        preco_unitario: 420.00
      }
    ],
    valor_total: 440.00,
    status: "em_separacao",
    data_pedido: new Date("2026-09-13T08:30:00Z"),
    entrega: {
      endereco_completo: "Rua Brigadeiro Rocha, 1200 - Centro, Guarapuava-PR, CEP 85010-210",
      codigo_rastreio: null,
      valor_frete: 20.00
    }
  }
]);

print("=== [MongoDB] RetroVault inicializado com sucesso! ===");
print("Categorias cadastradas: " + db.categorias.countDocuments());
print("Jogos no catálogo:      " + db.jogos.countDocuments());
print("Clientes cadastrados:   " + db.clientes.countDocuments());
print("Pedidos registrados:    " + db.pedidos.countDocuments());
