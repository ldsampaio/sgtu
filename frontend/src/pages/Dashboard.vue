<template>
  <section class="cartao cartao--larga">
    <div class="page-head">
      <h1>Dashboard</h1>
    </div>

    <p class="sub">
      Medidores por sistema e por dia, a partir do agregado permanente
      <code>sgtu.vuso_diario</code> — onda 6 do plano.
    </p>

    <LinhaVazia texto="Nenhum medidor ainda." />
  </section>
</template>

<script setup>
import LinhaVazia from '../components/LinhaVazia.vue';
</script>
