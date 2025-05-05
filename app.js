import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'segredo',
    resave: false,
    saveUninitialized: false,
  })
);

// Middleware de autenticação
function isAuthenticated(req, res, next) {
  if (req.session.admin) return next();
  res.redirect('/login');
}

// Página inicial
app.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM links ORDER BY id DESC');
    res.render('index', { links: rows });
  } catch (err) {
    console.error('Erro ao carregar links:', err);
    res.status(500).send('Erro ao carregar os links');
  }
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
  try {
    const { rows } = await pool.query('SELECT * FROM links ORDER BY id DESC');
    res.render('admin', { links: rows });
  } catch (err) {
    console.error('Erro ao carregar painel:', err);
    res.status(500).send('Erro ao carregar o painel');
  }
});

// Adicionar link
app.post('/admin/add', isAuthenticated, async (req, res) => {
  const { titulo, url } = req.body;
  try {
    await pool.query('INSERT INTO links (titulo, url) VALUES ($1, $2)', [titulo, url]);
    res.redirect('/admin');
  } catch (err) {
    console.error('Erro ao adicionar link:', err);
    res.status(500).send('Erro ao adicionar link');
  }
});

// Deletar link
app.post('/admin/delete/:id', isAuthenticated, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query('DELETE FROM links WHERE id = $1', [id]);
    res.redirect('/admin');
  } catch (err) {
    console.error('Erro ao deletar link:', err);
    res.status(500).send('Erro ao deletar link');
  }
});

// Inicializa o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
