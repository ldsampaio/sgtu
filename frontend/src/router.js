import { createRouter, createWebHistory } from 'vue-router';
import { beacon } from './beacon.js';
import TicketsLista from './pages/TicketsLista.vue';
import TicketDetalhe from './pages/TicketDetalhe.vue';
import TicketNovo from './pages/TicketNovo.vue';
import MeusDados from './pages/MeusDados.vue';
import Privacidade from './pages/Privacidade.vue';
import Dashboard from './pages/Dashboard.vue';
import ErrorPage from './pages/ErrorPage.vue';

export const ROTAS = [
  { path: '/', redirect: '/tickets' },
  { path: '/tickets', component: TicketsLista },
  { path: '/tickets/novo', component: TicketNovo },
  { path: '/tickets/:id', component: TicketDetalhe },
  { path: '/meus-dados', component: MeusDados },
  { path: '/privacidade', component: Privacidade },
  { path: '/dashboard', component: Dashboard },
  { path: '/erro/:codigo', name: 'erro', component: ErrorPage },
  // Fallback: o código fica na URL porque o usuário precisa citar o número
  // quando abre um ticket. Só o path vai como destino — nunca query de terceiros.
  {
    path: '/:pathMatch(.*)*',
    name: 'fallback',
    redirect: (to) => ({ path: '/erro/404', query: { destino: to.path } }),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes: ROTAS,
  // `.ativo` é a classe da navbar no design system.
  linkActiveClass: 'ativo',
});

// Beacon best-effort: falha de telemetria nunca afeta a navegação.
router.afterEach((to) => {
  beacon({ evento: 'page_view', rota: to.path, metadata: { rota: to.path } });
});

export default router;
