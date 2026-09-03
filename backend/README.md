# AR Exporter — Backend (Cloudflare Workers)

Deploy em ~10 minutos. Você só faz isso uma vez.

---

## Pré-requisitos

- Conta no [Cloudflare](https://cloudflare.com) (gratuita)
- Node.js instalado ([nodejs.org](https://nodejs.org))

---

## 1. Instalar o Wrangler (CLI do Cloudflare)

```bash
npm install -g wrangler
wrangler login
```

Vai abrir o navegador para autenticar. Faça login com sua conta Cloudflare.

---

## 2. Criar o bucket R2 (storage de arquivos)

```bash
wrangler r2 bucket create ar-exporter-files
```

---

## 3. Criar o banco D1

```bash
wrangler d1 create ar-exporter-db
```

O comando vai retornar um `database_id`. Cole esse ID no `wrangler.toml`:

```toml
database_id = "SEU_ID_AQUI"
```

---

## 4. Criar as tabelas

```bash
wrangler d1 execute ar-exporter-db --file=schema.sql
```

---

## 5. Definir o ADMIN_SECRET

Esse secret protege o endpoint de adição de tokens Pro. Escolha uma senha forte:

```bash
wrangler secret put ADMIN_SECRET
```

Digite a senha quando solicitado.

---

## 6. Deploy

```bash
wrangler deploy
```

O comando vai mostrar a URL do Worker, algo como:
```
https://ar-exporter.SEU_SUBDOMINIO.workers.dev
```

**Copie essa URL e atualize no plugin:**
Em `blender_ar_exporter_v2.py`, linha 23:
```python
BACKEND_URL = "https://ar-exporter.SEU_SUBDOMINIO.workers.dev"
```

---

## Gerenciar tokens Pro

Quando alguém comprar no Gumroad/Hotmart, adicione o token Pro via:

```bash
curl -X POST https://ar-exporter.SEU_SUBDOMINIO.workers.dev/admin/add-token \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: SUA_SENHA" \
  -d '{"label": "Gumroad #1234"}'
```

O comando retorna o token gerado. Você manda esse token por e-mail para o comprador.

---

## Ver scans de um arquivo (Pro)

```bash
curl https://ar-exporter.SEU_SUBDOMINIO.workers.dev/analytics/FILE_ID \
  -H "Authorization: Bearer TOKEN_PRO_DO_USUARIO"
```

---

## Custos estimados (Cloudflare)

| Recurso | Free tier | Custo depois |
|---|---|---|
| R2 Storage | 10 GB/mês grátis | $0,015/GB |
| R2 Bandwidth | Grátis (sem egress fee) | — |
| Workers | 100k req/dia grátis | $5/mês ilimitado |
| D1 | 5 GB grátis | muito barato |

Para os primeiros meses de uso, **o custo total é R$ 0**.
