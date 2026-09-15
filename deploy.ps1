param(
  [string]$ProjectName = 'rvartesanal'
)

# Publica o site estático no Cloudflare Pages da conta autenticada no Wrangler.
# Antes do primeiro deploy: npx wrangler login
# Crie o projeto uma vez: npx wrangler pages project create $ProjectName --production-branch main

New-Item -ItemType Directory -Path 'public' -Force | Out-Null
Copy-Item -LiteralPath 'index.html' -Destination 'public/index.html' -Force
Copy-Item -LiteralPath 'style.css'  -Destination 'public/style.css'  -Force
Copy-Item -LiteralPath 'script.js'  -Destination 'public/script.js'  -Force
Copy-Item -LiteralPath 'assets'     -Destination 'public'            -Recurse -Force

npx --yes wrangler pages deploy public --project-name $ProjectName --branch main
