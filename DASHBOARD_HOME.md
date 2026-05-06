# Dashboard Home - AI Running Coach

## 📁 File Modificato

```
app/
├── layout.tsx    ← Aggiornato metadata
└── page.tsx      ← Dashboard completa (SOSTITUITO)
```

## 🎨 Design System

### **Stile Scuro Premium**
- **Background:** `bg-neutral-950` (quasi nero)
- **Cards:** `bg-neutral-900` con `border-neutral-800`
- **Rounded:** `rounded-3xl` per angoli morbidi
- **Testo:** Bianco principale, `text-neutral-400` per secondario
- **Accenti:** Blu per bottoni (`bg-blue-600`)

### **Layout Responsive**
- **Desktop:** Grid 2/3 colonne (ultima corsa più larga)
- **Mobile:** Stack verticale
- **Max width:** `max-w-7xl` centrato
- **Padding:** Responsive (`px-4 sm:px-6 lg:px-8`)

## 📊 Dati Mostrati

### **Ultima Corsa Card**
```sql
SELECT a.*, cr.title, cr.summary, cr.risk_level, cr.next_48h
FROM activities a
LEFT JOIN coach_reports cr ON a.id = cr.activity_id
WHERE a.type IN ('Run', 'TrailRun')
ORDER BY a.start_date DESC
LIMIT 1
```

**Mostra:**
- ✅ Nome corsa e data formattata
- ✅ Distanza, durata, FC media (se presente)
- ✅ Tipo corsa (Run/TrailRun)
- ✅ Titolo report AI
- ✅ Summary e livello rischio con emoji
- ✅ Prossime 48 ore
- ✅ Bottone "Apri Report Completo" → `/runs/[id]`

### **Trend Settimanale Card**
```sql
WITH weekly_stats AS (
  SELECT
    DATE_TRUNC('week', start_date) as week_start,
    COUNT(*) as runs,
    SUM(distance_m) as total_distance
  FROM activities
  WHERE type IN ('Run', 'TrailRun')
    AND start_date >= NOW() - INTERVAL '6 weeks'
  GROUP BY DATE_TRUNC('week', start_date)
)
SELECT EXTRACT(WEEK FROM week_start)::INTEGER as week, runs, total_distance
FROM weekly_stats
ORDER BY week_start DESC
LIMIT 6
```

**Mostra:**
- ✅ Ultime 6 settimane
- ✅ Numero uscite per settimana
- ✅ Chilometri totali per settimana
- ✅ Layout a card per ogni settimana

## 🚀 Come Testare

### **1. Avvia il Server**
```bash
npm run dev
```

### **2. Apri Browser**
```
http://localhost:3000
```

### **3. Stati Possibili**

#### **Empty State** (nessuna corsa)
- Messaggio elegante
- Icona running
- Spiegazione sincronizzazione automatica

#### **Con Dati**
- Card ultima corsa con report AI
- Trend settimanale
- Layout responsive

#### **Errore Database**
- Card errore rossa
- Bottone "Riprova"
- Messaggio user-friendly

## 🔧 Helper Functions

### **Formattazione Dati**
```typescript
formatKm(5210)        // "5.2 km"
formatDuration(2730)  // "45 min"
formatDate(dateString) // "lunedì 15 gennaio"
getRiskEmoji('basso') // "🟢"
```

### **Gestione Errori**
- **Database error:** Mostra card errore invece di crash
- **Query fallita:** Log errore, mostra empty state
- **Dati mancanti:** Gestione graceful con optional chaining

## 📱 Responsive Design

### **Mobile (< 1024px)**
```
┌─────────────────┐
│   AI Running    │
│     Coach       │
├─────────────────┤
│  Ultima Corsa   │ ← Full width
│  [Dettagli...]  │
├─────────────────┤
│  Trend Weekly   │ ← Full width
│  [6 settimane]  │
└─────────────────┘
```

### **Desktop (≥ 1024px)**
```
┌─────────────────┬─────────────┐
│   AI Running    │             │
│     Coach       │             │
├─────────────────┼─────────────┤
│  Ultima Corsa   │ Trend       │
│  [Dettagli...]  │ Weekly      │ ← 2:1 ratio
│                 │ [6 sett]    │
└─────────────────┴─────────────┘
```

## 🎯 User Experience

### **Prima Sincronizzazione**
- Empty state informativo
- Spiega che la sync è automatica ogni 6 ore
- Icona running motivante

### **Con Dati**
- Ultima corsa sempre visibile
- Report AI prominente
- Trend per vedere progresso
- Call-to-action chiaro per report completo

### **Error Handling**
- Nessun crash dell'app
- Messaggi user-friendly
- Possibilità di retry

## 🔄 Aggiornamenti Automatici

La dashboard si aggiorna automaticamente quando:
- ✅ Nuove corse vengono sincronizzate
- ✅ Report AI vengono generati
- ✅ Utente ricarica la pagina

**Non c'è bisogno di refresh manuale!**

## 📊 Performance

### **Ottimizzazioni Implementate**
- **Single query** per ultima corsa + report
- **Efficient aggregation** per trend settimanale
- **No N+1 queries** - tutto in 2 query max
- **Error boundaries** - graceful degradation

### **Caricamento**
- **Server-side rendering** - dati pronti al primo load
- **No client-side fetching** - tutto prerendered
- **Fast queries** grazie agli indici DB

## 🎨 Estensioni Future

### **Possibili Miglioramenti**
- **Grafici:** Aggiungere chart.js per trend visivi
- **Metriche aggiuntive:** Pace medio, FC zones, elevazione
- **Filtri:** Per periodo, tipo corsa, distanza
- **Confronto:** Questa settimana vs settimana scorsa
- **Goal tracking:** Progressi verso obiettivi

### **Animazioni**
- **Fade-in** per cards al caricamento
- **Hover effects** su elementi interattivi
- **Loading states** durante aggiornamenti

## 🔗 Integrazione con Altre Route

### **Link al Report Dettagliato**
- Bottone "Apri Report Completo" → `/runs/[id]`
- Passa ID corsa nell'URL
- Mostra report completo + piano settimanale

### **Possibili Route Future**
- `/runs` - Lista tutte le corse
- `/stats` - Statistiche avanzate
- `/goals` - Obiettivi e progressi
- `/settings` - Configurazione app

## 📞 Support

**Dashboard completamente funzionale con:**
- ✅ Design scuro premium e responsive
- ✅ Integrazione DB efficiente
- ✅ Gestione errori robusta
- ✅ Empty state elegante
- ✅ Formattazione dati italiana
- ✅ Call-to-action chiari
- ✅ Performance ottimizzate

**Perfetta come homepage dell'app!** 🚀
