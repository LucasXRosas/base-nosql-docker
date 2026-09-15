UNIVERSIDADE TECNOLÓGICA FEDERAL DO PARANÁ — UTFPR
CAMPUS GUARAPUAVA
CURSO: Tecnologia em Sistemas para Internet (TSI34E-TSI4)
DISCIPLINA: Banco de Dados NoSQL | PROFESSOR: Prof. Marcelo Vichar
AVALIAÇÃO 1 — CHECKPOINT 1: Proposta, Modelagem e Arquitetura Inicial do Projeto
DATA DE ENTREGA / AVALIAÇÃO: 20/09/2026 (até 23h59) PESO NA DISCIPLINA: 20% da Nota Final
LOCAL DE AVALIAÇÃO: Repositório Git (Branch 'main') FORMATO: Equipes de Projeto Semestral
ESPECIFICAÇÃO E DIRETRIZES DE ENTREGA — CHECKPOINT 1
⚠ ATENÇÃO MÁXIMA — FORMATO E LOCAL DE AVALIAÇÃO: A entrega deste Checkpoint NÃO é realizada via
envio de arquivos compactados (.zip/.rar) ou PDFs no Moodle! A avaliação será realizada ESTRITAMENTE sobre o
repositório Git oficial de cada equipe no GitHub. No Moodle, o grupo deverá apenas preencher o formulário
simples informando o link do repositório e os integrantes.
REGRAS INEGOCIÁVEIS DO GIT:
1. AVALIAÇÃO EXCLUSIVA NA BRANCH 'main': O professor clonará e executará o projeto exatamente no estado em
que ele estiver na branch 'main' na data limite (15/09 às 23h59). Branches secundárias (ex: dev, feature/*) NÃO
serão avaliadas.
2. CUIDADO COM MERGES QUEBRADOS: Só suba para a 'main' o código e a documentação que estiverem 100%
validados, testados e funcionais. Qualquer commit incompleto na 'main' impactará diretamente a nota da equipe.
1. Objetivo Pedagógico e Escopo da Entrega
O Checkpoint 1 consolida a etapa de concepção, modelagem orientada a documentos e prototipação de
dados do projeto semestral da disciplina. Cada equipe deve definir um sistema web com problema e
domínio reais, modelar suas coleções no MongoDB aplicando conscientemente as decisões de
Embedding vs. Referencing, popular o banco localmente via Docker e demonstrar 5 consultas
analíticas/operacionais que alimentam as telas da aplicação.
2. Estrutura de Arquivos Obrigatória na Branch 'main'
O repositório clonado da equipe deve conter, obrigatoriamente, a seguinte estrutura implementada:
● CHECKPOINT_1.md (ou README.md): Documento técnico estruturado contendo a especificação completa do projeto
(veja a Seção 3 deste documento para o roteiro detalhado de seções).
● init.js (ou init/mongo-init.js): Script executável em JavaScript que inicializa o banco MongoDB do projeto via Docker,
criando as coleções, índices necessários e inserindo no mínimo 20 documentos realistas com referências funcionais.
● app/src/controllers/ e app/src/routes/: Os Controllers e Rotas da aplicação Node.js/TypeScript (Express) implementando
os endpoints das 5 consultas de negócio que alimentam as telas do sistema conectando diretamente ao MongoDB via
driver oficial.⚡ Nota de Avaliação: A validação do Checkpoint 1 é realizada diretamente pela execução do ecossistema Docker
(executando o init.js) e pelos testes dos endpoints nos Controllers (app/src/controllers/). Arquivos de playground
(.mongodb.js) NÃO fazem parte da entrega do Checkpoint 1.
3. Roteiro e Conteúdo do Arquivo CHECKPOINT_1.md
• Seção 1: Tema e Escopo do Sistema (15 pts): Descrição em 2 a 3 parágrafos claros: qual é o problema real que o
sistema resolve, quais são os usuários principais e o que justifica o uso de banco de dados NoSQL. O tema deve ser
estritamente autoral (projetos sobre delivery gastronômico similar ao GastroHub serão penalizados).
• Seção 2: Entidades e Coleções (25 pts): Definição de no mínimo 4 coleções distintas. Para cada coleção, listar
todos os campos e seus respectivos tipos BSON (ObjectId, String, Number, Boolean, Date, Array, Subdocumento). Pelo
menos 2 coleções devem conter dados compostos (subdocumentos embutidos ou arrays).
• Seção 3: Justificativa Técnica: Embedding vs. Referencing (20 pts): Tabela de decisões arquiteturais. Para
cada relacionamento entre entidades, explicar se a equipe optou por Embutir (Embedding) ou Referenciar
(Referencing), justificando tecnicamente a escolha com base em padrões de acesso, volume de crescimento e trade-offs
(ex: imutabilidade histórica, prevenção do limite de 16MB).
• Seção 4: Relacionamentos e Cardinalidade (15 pts): Mapeamento explícito das cardinalidades (1:1, 1:N, N:N)
entre todas as entidades, acompanhado de uma tabela de chaves ou diagrama conceitual (ex: diagrama Mermaid ou
imagem legível).
• Seção 5: Exemplos de Documentos JSON (15 pts): Apresentação de pelo menos 1 documento JSON completo,
sintaticamente válido e com dados realistas para cada uma das coleções modeladas.
• Seção 6: Relatórios e Indicadores de Negócio (10 pts): Descrição detalhada de 5 consultas fundamentais que
alimentam telas ou relatórios do sistema (ex: buscas filtradas com múltiplos critérios, ordenações, projeções
econômicas para mobile, atualizações atômicas).
4. Rubrica Oficial de Pontuação (0 a 100 pontos)
Critério Avaliado Peso Expectativa para Nota Máxima
(Excelente)
1. Tema e Escopo 15 pts Tema original, problema real bem
contextualizado, público definido,
diferente do GastroHub.
2. Entidades e Tipos BSON 25 pts Mínimo de 4 coleções coerentes, tipos
BSON explícitos, pelo menos 2 com dados
compostos.
3. Embedding vs Referencing 20 pts Justificativas técnicas impecáveis com
trade-offs compreendidos (imutabilidade,
volume, concorrência).
4. Relacionamentos e Card. 15 pts Todas as cardinalidades (1:1, 1:N, N:N)
mapeadas sem erros, diagrama claro.
5. Exemplos JSON e init.js 15 pts JSONs realistas e script init.js funcional
rodando no Docker com pelo menos 20
documentos.
6. Relatórios e Endpoints na API 10 pts 5 consultas viáveis implementadas
diretamente nos Controllers da aplicação
(app/src/controllers/) com rotas REST
ativas e funcionais.
5. Modelo de Referência e Benchmark de Qualidade
💡 MODELO DISPONÍVEL NO REPOSITÓRIO BASE: Para orientar o desenvolvimento e esclarecer o nível de
qualidade e profundidade exigido, o professor disponibilizou no repositório base da disciplina uma branch de
exemplo oficial:
Comando para inspecionar no Git:
git checkout exemplo-checkpoint-1
Arquivos de referência presentes na branch:
• CHECKPOINT_1_MODELO.md: Exemplo completo de documentação do GastroHub atendendo a 100% da
rubrica.
• init/mongo-init.js: Script de povoamento inicial, criação de índices e validações de integridade.
• app/src/controllers/ e routes/: Controllers TypeScript com as 5 consultas conectadas nativamente ao MongoDB.
• Validação 100% Integrada: O professor avalia o Checkpoint 1 rodando o Docker (init.js) e testando os endpoints