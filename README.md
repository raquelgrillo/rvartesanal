# Confeitaria RRV

Mini e-commerce estático para selecionar produtos, informar entrega e abrir o WhatsApp da confeitaria com o pedido preenchido.

Site atual: https://confeitariarrv.pages.dev/

## Estrutura

- `index.html`: estrutura da página.
- `style.css`: aparência e layout responsivo.
- `script.js`: catálogo, preços, carrinho, etapas, mural e mensagem do WhatsApp.
- `assets/`: logo e fotos.
- `deploy.ps1`: prepara a pasta pública e publica no Cloudflare Pages.

Não há backend, banco de dados ou processamento de pagamentos. O pedido é enviado pelo próprio cliente no WhatsApp.

## Abrir localmente

Com Python instalado, execute na pasta do projeto:

```powershell
python -m http.server 8769 --bind 127.0.0.1
```

Depois abra http://127.0.0.1:8769/.

## Publicar na sua própria conta Cloudflare

Requisitos: Node.js e uma conta Cloudflare.

1. Clone o repositório e entre na pasta:

   ```bash
   git clone https://github.com/vieirs22-cloud/confeitariarrv.git
   cd confeitariarrv
   ```

2. Autorize o Wrangler na sua conta Cloudflare:

   ```bash
   npx wrangler login
   ```

3. Crie um projeto Pages. Escolha um nome disponível para o endereço `nome.pages.dev`:

   ```bash
   npx wrangler pages project create meu-projeto --production-branch main
   ```

4. No Windows PowerShell, publique passando o mesmo nome:

   ```powershell
   .\deploy.ps1 -ProjectName meu-projeto
   ```

   Em macOS ou Linux, prepare e publique assim:

   ```bash
   rm -rf public
   mkdir -p public
   cp index.html style.css script.js public/
   cp -R assets public/assets
   npx wrangler pages deploy public --project-name meu-projeto --branch main
   ```

Depois do primeiro deploy, repita somente a etapa 4 para publicar alterações.

## Personalizar

O catálogo e os preços ficam no array `products` em `script.js`. Os preços são informados em centavos. O número de destino do WhatsApp aparece no fim do mesmo arquivo, no endereço `wa.me`.

O mural é definido em `index.html`, dentro de `.mural-track`. Coloque novas imagens em `assets/`, adicione os elementos correspondentes e atualize a quantidade indicada nos rótulos das fotos.

Não salve tokens, senhas ou credenciais do Cloudflare no repositório.
