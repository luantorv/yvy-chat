<script>
  import { onMount } from 'svelte'
  import Chart from 'chart.js/auto'

  const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

  let messages = []
  let input = ''
  let busy = false
  let endEl
  let barEl
  let lineEl

  let backendReady = false
  let healthTimer

  let pdfFile = null
  let uploading = false
  let uploadError = ''
  let uploadOk = ''

  $: messages, busy, endEl?.scrollIntoView({ behavior: 'smooth' })

  async function checkHealth() {
    try {
      const res = await fetch(`${API_URL}/health`)
      const data = await res.json()
      backendReady = !!data.chatEngineReady
    } catch {
      backendReady = false
    }
    if (!backendReady) healthTimer = setTimeout(checkHealth, 2000)
  }

  function parseCSV(text) {
    const [hdr, ...rows] = text.trim().split('\n')
    const keys = hdr.split(',').map(k => k.trim())
    return rows.map(r => {
      const vals = r.split(',')
      return Object.fromEntries(
        keys.map((k, i) => [k, isNaN(Number(vals[i])) ? vals[i] : Number(vals[i])])
      )
    })
  }

  function onFileChange(e) {
    pdfFile = e.target.files?.[0] ?? null
    uploadError = ''
  }

  async function uploadPdf() {
    if (!pdfFile || uploading) return
    uploading = true
    uploadError = ''
    uploadOk = ''
    try {
      const form = new FormData()
      form.append('file', pdfFile)
      const res = await fetch(`${API_URL}/api/documents`, {
        method: 'POST',
        body: form
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al procesar el PDF')
      backendReady = true
      uploadOk = `"${pdfFile.name}" agregado a la base de conocimiento (${data.pages} páginas).`
      pdfFile = null
    } catch (err) {
      uploadError = err.message ?? 'Error al subir el PDF.'
    }
    uploading = false
  }

  async function send() {
    const q = input.trim()
    if (!q || busy || !backendReady) return
    messages = [...messages, { role: 'human', text: q }]
    input = ''
    busy = true
    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error generando la respuesta')
      messages = [...messages, { role: 'ai', text: data.response }]
    } catch (err) {
      messages = [...messages, { role: 'ai', text: `❌ ${err.message ?? 'Error al conectar.'}` }]
    }
    busy = false
  }

  function handleKey(e) {
    if (e.key === 'Enter') send()
  }

  onMount(async () => {
    checkHealth()

    // --- Bar chart ---
    let barData = [
      { name: 'Lote A', humedad: 68, temp: 27.5 },
      { name: 'Lote B', humedad: 61, temp: 26.8 }
    ]
    try {
      const r = await fetch('/data/kpi_bar.csv')
      if (r.ok) barData = parseCSV(await r.text())
    } catch {}

    const barChart = new Chart(barEl, {
      type: 'bar',
      data: {
        labels: barData.map(r => r.name),
        datasets: [
          {
            label: 'Humedad (%)',
            data: barData.map(r => r.humedad),
            backgroundColor: 'rgba(54, 162, 235, 0.7)'
          },
          {
            label: 'Temp (°C)',
            data: barData.map(r => r.temp),
            backgroundColor: 'rgba(255, 99, 132, 0.7)'
          }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    })

    // --- Line chart ---
    let lineData = [
      { h: '00', suelo: 68, aire: 22 },
      { h: '04', suelo: 65, aire: 20 },
      { h: '08', suelo: 70, aire: 24 },
      { h: '12', suelo: 72, aire: 28 }
    ]
    try {
      const r = await fetch('/data/kpi_line.csv')
      if (r.ok) lineData = parseCSV(await r.text())
    } catch {}

    const lineChart = new Chart(lineEl, {
      type: 'line',
      data: {
        labels: lineData.map(r => r.h),
        datasets: [
          {
            label: 'Suelo',
            data: lineData.map(r => r.suelo),
            borderColor: 'rgba(153, 102, 255, 1)',
            backgroundColor: 'rgba(153, 102, 255, 0.1)',
            tension: 0.3,
            fill: true
          },
          {
            label: 'Aire',
            data: lineData.map(r => r.aire),
            borderColor: 'rgba(255, 159, 64, 1)',
            backgroundColor: 'rgba(255, 159, 64, 0.1)',
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    })

    return () => {
      barChart.destroy()
      lineChart.destroy()
      clearTimeout(healthTimer)
    }
  })
</script>

<div class="container-fluid" style="height: calc(100vh - 56px);">
  <div class="row h-100 g-2 p-2">

    <!-- Chat -->
    <div class="col-12 col-lg-6 d-flex flex-column" style="min-height: 0;">
      <div class="card flex-grow-1 d-flex flex-column" style="min-height: 0;">
        <div class="card-header fw-semibold">
          <i class="bi bi-chat-dots-fill me-2 text-success"></i>Chat RAG · YVY AI
        </div>

        <div class="card-body border-bottom py-2">
          {#if !backendReady}
            <div class="text-muted small">
              <span class="spinner-border spinner-border-sm me-1"></span>
              Cargando la base de conocimiento…
            </div>
          {/if}
          <details>
            <summary class="text-muted small" style="cursor: pointer;">
              Agregar un PDF adicional (opcional)
            </summary>
            <div class="input-group input-group-sm mt-2">
              <input
                type="file"
                accept="application/pdf"
                class="form-control"
                on:change={onFileChange}
                disabled={uploading}
              />
              <button class="btn btn-outline-success" on:click={uploadPdf} disabled={!pdfFile || uploading}>
                {uploading ? 'Procesando…' : 'Subir PDF'}
              </button>
            </div>
            {#if uploadError}
              <div class="text-danger small mt-1">{uploadError}</div>
            {:else if uploadOk}
              <div class="text-success small mt-1">{uploadOk}</div>
            {/if}
          </details>
        </div>

        <div
          class="card-body overflow-auto"
          style="flex: 1 1 0; min-height: 0"
        >
          {#each messages as msg}
            {#if msg.role === 'human'}
              <div style="
                background: #111827;
                color: white;
                border-radius: 0.75rem;
                padding: 0.5rem 0.75rem;
                max-width: 85%;
                margin-left: auto;
                margin-bottom: 0.5rem;
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                white-space: pre-wrap;
              ">
                {msg.text}
              </div>
            {:else}
              <div style="
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 0.75rem;
                padding: 0.5rem 0.75rem;
                max-width: 85%;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                white-space: pre-wrap;
                margin-bottom: 0.5rem;
              ">
                {msg.text}
              </div>
            {/if}
          {/each}

          {#if busy}
            <div style="
              background: white;
              border: 2px solid #fd9992;
              border-radius: 0.75rem;
              padding: 0.5rem 0.75rem;
              max-width: 85%;
              color: #888;
              font-style: italic;
              margin-bottom: 0.5rem;
            ">
              Pensando…
            </div>
          {/if}

          <div bind:this={endEl}></div>
        </div>

        <div class="card-footer">
          <div class="input-group">
            <input
              type="text"
              class="form-control"
              placeholder={backendReady ? 'Preguntá algo sobre tus cultivos…' : 'Cargando la base de conocimiento…'}
              bind:value={input}
              on:keydown={handleKey}
              disabled={busy || !backendReady}
            />
            <button class="btn btn-primary" on:click={send} disabled={busy || !backendReady}>
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Charts -->
    <div class="col-12 col-lg-6 d-flex flex-column gap-2" style="min-height: 0;">
      <div class="card flex-grow-1">
        <div class="card-header fw-semibold">
          <i class="bi bi-bar-chart-fill me-2 text-primary"></i>Humedad / Temperatura por Lote
        </div>
        <div class="card-body" style="height: 280px; position: relative;">
          <canvas bind:this={barEl}></canvas>
        </div>
      </div>

      <div class="card flex-grow-1">
        <div class="card-header fw-semibold">
          <i class="bi bi-graph-up me-2 text-warning"></i>Tendencia 24 h – Suelo vs. Aire
        </div>
        <div class="card-body" style="height: 280px; position: relative;">
          <canvas bind:this={lineEl}></canvas>
        </div>
      </div>
    </div>

  </div>
</div>
