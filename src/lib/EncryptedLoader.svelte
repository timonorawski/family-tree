<!-- src/lib/EncryptedLoader.svelte -->
<script>
  import { onMount } from 'svelte';
  import {
    getKeyFromFragment,
    loadPersistedKey,
    persistKey,
    clearPersistedKey
  } from 'static-crypt/browser';
  import { decrypt } from 'static-crypt/browser';

  let { onLoad, onError } = $props();

  let state = $state('loading'); // 'loading' | 'prompt' | 'error'
  let errorMessage = $state('');

  onMount(async () => {
    // Try URL fragment first, then localStorage
    let auth = getKeyFromFragment();
    if (!auth) {
      auth = loadPersistedKey();
    }

    if (!auth) {
      state = 'prompt';
      return;
    }

    const { tier, key } = auth;

    try {
      const res = await fetch(`/data/persons.${tier}.enc`);

      if (!res.ok) {
        if (res.status === 404) {
          clearPersistedKey();
          state = 'error';
          errorMessage = 'Access revoked or tier no longer exists.';
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const bundle = await res.json();
      const plaintext = await decrypt(bundle, key);
      const persons = JSON.parse(new TextDecoder().decode(plaintext));

      // Persist for future visits
      persistKey(tier, key);

      // Clear fragment from URL for cleaner sharing
      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }

      onLoad(persons);
    } catch (err) {
      console.error('Decryption failed:', err);
      clearPersistedKey();
      state = 'error';
      errorMessage = 'Access expired or revoked. Please request a new access link.';
    }
  });
</script>

{#if state === 'loading'}
  <div class="loader-container">
    <div class="spinner"></div>
    <p>Loading...</p>
  </div>
{:else if state === 'prompt'}
  <div class="loader-container">
    <h2>Access Required</h2>
    <p>Scan the QR code or use the access link provided to view this family tree.</p>
  </div>
{:else if state === 'error'}
  <div class="loader-container">
    <h2>Access Denied</h2>
    <p>{errorMessage}</p>
    <p>Contact the tree owner for a new access link.</p>
  </div>
{/if}

<style>
  .loader-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: rgb(33, 33, 33);
    color: #fff;
    text-align: center;
    padding: 2rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #444;
    border-top-color: #5e60ce;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  h2 {
    margin-bottom: 1rem;
  }

  p {
    color: #aaa;
    max-width: 400px;
  }
</style>
