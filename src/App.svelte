<script lang="ts">
  let ready = false;

  import { onMount } from 'svelte';

  onMount(() => {
    ready = true;
  });
</script>

<main>
  <div class="container">
    <h1>MD+HTML Reader</h1>
    <p class="subtitle">Markdown 预览 · 编辑 · 评论</p>

    {#if ready}
      <div class="status">✓ 应用已就绪</div>
    {/if}
  </div>
</main>

<style>
  main {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background-color: #f5f5f7;
  }

  .container {
    text-align: center;
    padding: 48px;
  }

  h1 {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
    font-size: 40px;
    font-weight: 600;
    line-height: 1.1;
    color: #1d1d1f;
    margin-bottom: 12px;
  }

  .subtitle {
    font-size: 21px;
    font-weight: 600;
    line-height: 1.19;
    color: #1d1d1f;
    margin-bottom: 24px;
  }

  .status {
    font-size: 14px;
    color: #0066cc;
    margin-top: 24px;
  }
</style>
