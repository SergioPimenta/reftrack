const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

let initPromise = null;

function initDb() {
  if (!initPromise) {
    initPromise = pool.connect().then(async (client) => {
      try {
        // Cria tabela de usuarios
        await client.query(`
          CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            nome TEXT NOT NULL,
            usuario TEXT NOT NULL UNIQUE,
            senha TEXT NOT NULL,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Cria tabela de indicadores
        await client.query(`
          CREATE TABLE IF NOT EXISTS indicadores (
            id SERIAL PRIMARY KEY,
            nome TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            comissao_percentual REAL DEFAULT 10,
            ativo INTEGER DEFAULT 1,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Cria tabela de vendas
        await client.query(`
          CREATE TABLE IF NOT EXISTS vendas (
            id SERIAL PRIMARY KEY,
            indicador_id INTEGER REFERENCES indicadores(id) ON DELETE SET NULL,
            transaction_id TEXT UNIQUE,
            produto_nome TEXT,
            comprador_email TEXT,
            comprador_nome TEXT,
            valor REAL,
            comissao_valor REAL,
            status TEXT,
            src_recebido TEXT,
            data_venda TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Verifica se há dados na tabela de usuarios para o seed de admin base
        const resUsuarios = await client.query('SELECT COUNT(*) as count FROM usuarios');
        const countUsuarios = parseInt(resUsuarios.rows[0].count, 10);
        if (countUsuarios === 0) {
          console.log('Criando usuário administrador padrão (admin/admin123)...');
          const bcrypt = require('bcryptjs');
          const hash = await bcrypt.hash('admin123', 10);
          await client.query('INSERT INTO usuarios (nome, usuario, senha) VALUES ($1, $2, $3)', ['Admin Principal', 'admin', hash]);
        }

        // Verifica se há dados na tabela de indicadores para fazer o seed
        const res = await client.query('SELECT COUNT(*) as count FROM indicadores');
        const countIndicadores = parseInt(res.rows[0].count, 10);

        if (countIndicadores === 0) {
          console.log('Populando banco de dados PostgreSQL com dados iniciais (seed)...');

          const insertIndQuery = \`INSERT INTO indicadores (nome, email, comissao_percentual) VALUES ($1, $2, $3) RETURNING id\`;
          const ind1 = await client.query(insertIndQuery, ['Alice Silva', 'alice@example.com', 15]);
          const ind2 = await client.query(insertIndQuery, ['Bruno Costa', 'bruno@example.com', 20]);
          const ind3 = await client.query(insertIndQuery, ['Carla Diaz', 'carla@example.com', 10]);

          const id1 = ind1.rows[0].id;
          const id2 = ind2.rows[0].id;
          const id3 = ind3.rows[0].id;

          const insertVendaQuery = \`
            INSERT INTO vendas (indicador_id, transaction_id, produto_nome, comprador_email, comprador_nome, valor, comissao_valor, status, src_recebido, data_venda) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP - ($10 || ' days')::INTERVAL)
          \`;

          const vendasData = [
            { indId: id1, tId: 'HP123451', p: 'Curso Beta', ce: 'cli1@mail.com', cn: 'Cliente Um', v: 100, status: 'APPROVED', src: 'alice@example.com', dias: '1' },
            { indId: id2, tId: 'HP123452', p: 'Curso Beta', ce: 'cli2@mail.com', cn: 'Cliente Dois', v: 100, status: 'APPROVED', src: 'bruno@example.com', dias: '2' },
            { indId: id3, tId: 'HP123453', p: 'Ebook Alpha', ce: 'cli3@mail.com', cn: 'Cliente Tres', v: 50, status: 'PENDING', src: 'carla@example.com', dias: '3' },
            { indId: id1, tId: 'HP123454', p: 'Mentoria Vip', ce: 'cli4@mail.com', cn: 'Cliente Quatro', v: 500, status: 'APPROVED', src: 'alice@example.com', dias: '5' },
            { indId: id2, tId: 'HP123455', p: 'Curso Beta', ce: 'cli5@mail.com', cn: 'Cliente Cinco', v: 100, status: 'REFUNDED', src: 'bruno@example.com', dias: '7' },
            { indId: null, tId: 'HP123456', p: 'Curso Beta', ce: 'cli6@mail.com', cn: 'Cliente Seis', v: 100, status: 'APPROVED', src: '', dias: '8' },
            { indId: id1, tId: 'HP123457', p: 'Ebook Alpha', ce: 'cli7@mail.com', cn: 'Cliente Sete', v: 50, status: 'APPROVED', src: 'alice@example.com', dias: '10' },
            { indId: id2, tId: 'HP123458', p: 'Mentoria Vip', ce: 'cli8@mail.com', cn: 'Cliente Oito', v: 500, status: 'APPROVED', src: 'bruno@example.com', dias: '14' },
            { indId: id3, tId: 'HP123459', p: 'Ebook Alpha', ce: 'cli9@mail.com', cn: 'Cliente Nove', v: 50, status: 'APPROVED', src: 'carla@example.com', dias: '20' },
            { indId: id1, tId: 'HP123460', p: 'Curso Beta', ce: 'cli10@mail.com', cn: 'Cliente Dez', v: 100, status: 'APPROVED', src: 'alice@example.com', dias: '25' }
          ];

          for (const v of vendasData) {
            let comissao = 0;
            if (v.status === 'APPROVED' && v.indId !== null) {
              const resInd = await client.query('SELECT comissao_percentual FROM indicadores WHERE id = $1', [v.indId]);
              comissao = (v.v * resInd.rows[0].comissao_percentual) / 100;
            }
            await client.query(insertVendaQuery, [v.indId, v.tId, v.p, v.ce, v.cn, v.v, comissao, v.status, v.src, v.dias]);
          }

          console.log('Seed concluído com sucesso.');
        }
      } catch (err) {
        console.error('Erro na inicialização do DB Postgres:', err);
      } finally {
        client.release();
      }
    }).catch(err => {
      console.error('Falha severa ao conectar pro Seed', err);
      initPromise = null; // permite tentar de novo
    });
  }
  return initPromise;
}

// Inicia se tiver a DATABASE_URL na raiz
if (process.env.DATABASE_URL) {
  initDb();
} else {
  console.log('Nenhuma DATABASE_URL configurada no .env. Ignorando conexão com Postgres.');
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  initDb
};
