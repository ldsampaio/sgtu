<template>
  <header class="navbar">
    <a class="marca" href="/tickets">SGTU</a>
    <nav aria-label="Navegação principal">
      <router-link to="/tickets">
        <Icon name="ticket" :size="16" /> Tickets
      </router-link>
      <router-link to="/dashboard">
        <Icon name="chart-bar" :size="16" /> Dashboard
      </router-link>
      <router-link to="/meus-dados">
        <Icon name="user" :size="16" /> Meus dados
      </router-link>
      <router-link to="/privacidade">
        <Icon name="shield" :size="16" /> Privacidade
      </router-link>
    </nav>
  </header>

  <main class="shell">
    <router-view />
  </main>
</template>

<script setup>
import Icon from './components/Icon.vue';
</script>
