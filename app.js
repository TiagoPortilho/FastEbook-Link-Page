import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Caminho do banco de dados
const file = path.join(__dirname, 'db.json');
const adapter = new JSONFile(file);

// Passa o defaultData aqui
const db = new Low(adapter, { links: [] });  

// Função para inicializar o banco de dados com dados padrão
async function initDatabase() {
  try {
    // Se o arquivo não existir, cria um com a estrutura inicial
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify({ links: [] }));
    }

    // Lê os dados do arquivo
    await db.read();

    // Se os dados não existirem ou estiverem incompletos, inicializa com a estrutura padrão
    if (!db.data) {
      db.data = { links: [] };
      await db.write();
    }
  } catch (error) {
    console.error('Erro ao inicializar o banco de dados:', error);
  }
}

await initDatabase(); // Chama a função para garantir que o banco está inicializado

// Configurações do app
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'segredo',
    resave: false,
    saveUninitialized: false
  })
);

// Middleware de autenticação
function isAuthenticated(req, res, next) {
  if (req.session.admin) return next();
  res.redirect('/login');
}

// Página inicial
app.get('/', async (req, res) => {
  await db.read();
  res.render('index', { links: db.data.links });
});

// Página de login
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Login POST
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const validUser = username === process.env.ADMIN_USER;
  const validPass = await bcrypt.compare(password, process.env.ADMIN_PASS);

  if (validUser && validPass) {
    req.session.admin = true;
    res.redirect('/admin');
  } else {
    res.render('login', { error: 'Credenciais inválidas!' });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Painel admin
app.get('/admin', isAuthenticated, async (req, res) => {
  await db.read();
  res.render('admin', { links: db.data.links });
});

// Adicionar link
app.post('/admin/add', isAuthenticated, async (req, res) => {
  const { titulo, url } = req.body;
  const novoId = Date.now();

  db.data.links.push({ id: novoId, titulo, url });
  await db.write();
  res.redirect('/admin');
});

// Deletar link
app.post('/admin/delete/:id', isAuthenticated, async (req, res) => {
  const id = parseInt(req.params.id);
  db.data.links = db.data.links.filter(link => link.id !== id);
  await db.write();
  res.redirect('/admin');
});

// Inicializa o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
