const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'reftrack.db');
const db = new Database(dbPath);

// Habilita as chaves estrangeiras
db.pragma('foreign_keys = ON');

function initDb() {
  // Cria tabela de indicadores
  db.exec(`
    CREATE TABLE IF NOT EXISTS indicadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      comissao_percentual REAL DEFAULT 10,
      ativo INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Cria tabela de vendas
  db.exec(`
    CREATE TABLE IF NOT EXISTS vendas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      indicador_id INTEGER,
      transaction_id TEXT UNIQUE,
      produto_nome TEXT,
      comprador_email TEXT,
      comprador_nome TEXT,
      valor REAL,
      comissao_valor REAL,
      status TEXT,
      src_recebido TEXT,
      data_venda TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (indicador_id) REFERENCES indicadores (id) ON DELETE SET NULL
    );
  `);

  // Verifica se há dados na tabela de indicadores para fazer o seed
  const countIndicadores = db.prepare('SELECT COUNT(*) as count FROM indicadores').get().count;

  if (countIndicadores === 0) {
    console.log('Populando banco de dados com dados iniciais (seed)...');

    const insertIndicador = db.prepare(`
      INSERT INTO indicadores (nome, email, comissao_percentual) VALUES (?, ?, ?)
    `);

    // Seed de 3 indicadores
    const ind1 = insertIndicador.run('Alice Silva', 'alice@example.com', 15);
    const ind2 = insertIndicador.run('Bruno Costa', 'bruno@example.com', 20);
    const ind3 = insertIndicador.run('Carla Diaz', 'carla@example.com', 10);

    // Seed de 10 vendas fictícias (a maioria para os indicadores, algumas órfãs)
    const insertVenda = db.prepare(`
      INSERT INTO vendas (indicador_id, transaction_id, produto_nome, comprador_email, comprador_nome, valor, comissao_valor, status, src_recebido, data_venda) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
    `);

    // Valores fictícios para vendas
    const vendasData = [
      { indId: ind1.lastInsertRowid, tId: 'HP123451', p: 'Curso Beta', ce: 'cli1@mail.com', cn: 'Cliente Um', v: 100, status: 'APPROVED', src: 'alice@example.com', dias: '-1 days' },
      { indId: ind2.lastInsertRowid, tId: 'HP123452', p: 'Curso Beta', ce: 'cli2@mail.com', cn: 'Cliente Dois', v: 100, status: 'APPROVED', src: 'bruno@example.com', dias: '-2 days' },
      { indId: ind3.lastInsertRowid, tId: 'HP123453', p: 'Ebook Alpha', ce: 'cli3@mail.com', cn: 'Cliente Tres', v: 50, status: 'PENDING', src: 'carla@example.com', dias: '-3 days' },
      { indId: ind1.lastInsertRowid, tId: 'HP123454', p: 'Mentoria Vip', ce: 'cli4@mail.com', cn: 'Cliente Quatro', v: 500, status: 'APPROVED', src: 'alice@example.com', dias: '-5 days' },
      { indId: ind2.lastInsertRowid, tId: 'HP123455', p: 'Curso Beta', ce: 'cli5@mail.com', cn: 'Cliente Cinco', v: 100, status: 'REFUNDED', src: 'bruno@example.com', dias: '-7 days' },
      { indId: null, tId: 'HP123456', p: 'Curso Beta', ce: 'cli6@mail.com', cn: 'Cliente Seis', v: 100, status: 'APPROVED', src: '', dias: '-8 days' }, // Sem indicador
      { indId: ind1.lastInsertRowid, tId: 'HP123457', p: 'Ebook Alpha', ce: 'cli7@mail.com', cn: 'Cliente Sete', v: 50, status: 'APPROVED', src: 'alice@example.com', dias: '-10 days' },
      { indId: ind2.lastInsertRowid, tId: 'HP123458', p: 'Mentoria Vip', ce: 'cli8@mail.com', cn: 'Cliente Oito', v: 500, status: 'APPROVED', src: 'bruno@example.com', dias: '-14 days' },
      { indId: ind3.lastInsertRowid, tId: 'HP123459', p: 'Ebook Alpha', ce: 'cli9@mail.com', cn: 'Cliente Nove', v: 50, status: 'APPROVED', src: 'carla@example.com', dias: '-20 days' },
      { indId: ind1.lastInsertRowid, tId: 'HP123460', p: 'Curso Beta', ce: 'cli10@mail.com', cn: 'Cliente Dez', v: 100, status: 'APPROVED', src: 'alice@example.com', dias: '-25 days' }
    ];

    for (const v of vendasData) {
      let comissao = 0;
      if (v.status === 'APPROVED' && v.indId !== null) {
        const ind = db.prepare('SELECT comissao_percentual FROM indicadores WHERE id = ?').get(v.indId);
        comissao = (v.v * ind.comissao_percentual) / 100;
      }
      insertVenda.run(v.indId, v.tId, v.p, v.ce, v.cn, v.v, comissao, v.status, v.src, v.dias);
    }
    
    console.log('Seed concluído com sucesso.');
  }
}

initDb();

module.exports = db;
