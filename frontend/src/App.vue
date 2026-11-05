<template>
  <header class="navbar">
    <a class="marca" href="/">SGTU</a>
    <nav>
      <a class="ativo" href="/tickets">
        <Icon name="ticket" :size="16" /> Tickets
      </a>
      <a href="/dashboard">
        <Icon name="chart-bar" :size="16" /> Dashboard
      </a>
    </nav>
  </header>

  <main class="shell">
    <div class="cartao cartao--larga">
      <h1>SGTU</h1>
      <p class="sub">
        Wave 0 — design system (Light Clay herdado do SGOA). As telas de ticket entram na
        onda 2 e o dashboard na onda 6.
      </p>

      <div class="linha-vazia">
        <Icon name="info" :size="20" />
        <span>Nenhum ticket ainda.</span>
      </div>
    </div>
  </main>
</template>

<script setup>
import Icon from './components/Icon.vue';
</script>
