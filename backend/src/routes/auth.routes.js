const express = require('express');
const { authJwt } = require('../middlewares/auth');

const router = express.Router();

// Quem eu sou — resolvido pelo contrato de sessão (Redis) + papel por sistema
// (sgtu.user_roles). Sem sessão → 401 com login_url (o frontend redireciona ao
// saga). É por aqui que o SPA decide o que renderiza (admin vs autor).
router.get('/me', authJwt, (req, res) => {
  res.json(req.user);
});

module.exports = router;
