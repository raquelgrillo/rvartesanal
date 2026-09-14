# Confeitaria RRV

Site: https://confeitariarrv.pages.dev/

## Onde editar

- `index.html`: estrutura da página (HTML).
- `style.css`: cores, tipografia e layout.
- `script.js`: catálogo de produtos, carrinho, etapas do formulário e carrossel de fotos.
- `assets/`: logo, fotos dos produtos e imagens do mural.
- `public/`: cópia dos arquivos enviada ao Cloudflare Pages. Não edite direto aqui — ela é sobrescrita pelo `deploy.ps1` (ou pelos comandos manuais) antes de cada publicação.

Projeto estático, sem build ou dependências para funcionar. Não há backend nem banco de dados. O carrinho e os dados existem somente na página enquanto ela está aberta.

## Funcionamento

Compra em quatro etapas: produtos, dados do cliente, entrega e pagamento. A revisão gera um link Click to WhatsApp para 5521972526975 com o pedido preenchido; o cliente confirma o envio no WhatsApp.

Preços no array `products` (em `script.js`), em centavos: pão 2000, cookie 700, brownie 1500, palha italiana 1500. A taxa de entrega fica a confirmar.

O mural alterna seis fotos a cada 5 segundos, sem controles visíveis. Pausa quando o mouse está sobre ele ou a página está em segundo plano, e respeita a preferência por movimento reduzido. A faixa permite deslizar horizontalmente.

## Prévia local

Na pasta deste projeto:

```powershell
python -m http.server 8769 --bind 127.0.0.1
```

Abra http://127.0.0.1:8769/. Se a porta já estiver em uso, reutilize o servidor atual ou escolha outra porta.

## Publicação no Cloudflare

O guia completo para publicar em outra conta está em `README.md`.

Depois de validar as alterações na prévia local, execute na pasta deste projeto:

```powershell
.\deploy.ps1 -ProjectName confeitariarrv
```

Esse script copia `index.html`, `style.css`, `script.js` e `assets/` para `public/` e publica com o Wrangler. Se preferir rodar os passos manualmente (ou o script não puder ser executado por causa da política de execução do PowerShell), o conteúdo dele é:

```powershell
Copy-Item -LiteralPath 'index.html' -Destination 'public/index.html' -Force
Copy-Item -LiteralPath 'style.css'  -Destination 'public/style.css'  -Force
Copy-Item -LiteralPath 'script.js'  -Destination 'public/script.js'  -Force
Copy-Item -LiteralPath 'assets'     -Destination 'public'            -Recurse -Force
npx --yes wrangler pages deploy public --project-name confeitariarrv --branch main
```

O script usa a conta autenticada pelo comando `npx wrangler login`. Não coloque credenciais nos arquivos do site.
