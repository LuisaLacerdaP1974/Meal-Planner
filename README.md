# Meal Planner — versão local

Esta é a versão da app que corre sozinha no teu PC, sem as limitações da versão de teste (sem bloqueios de partilha, sem limite de pesquisas, e os dados nunca desaparecem sozinhos).

## O que precisas de instalar (uma vez só)

**1. Node.js** — vai a https://nodejs.org, descarrega a versão "LTS" e instala como qualquer programa (Seguinte, Seguinte, Instalar).

Para confirmar que ficou instalado, abre o PowerShell e escreve:
```
node --version
```
Deve mostrar um número de versão (ex: v20.11.0).

## Como preparar a app (uma vez só)

1. Abre o PowerShell **dentro desta pasta** (clica na barra de endereço do Explorador de Ficheiros, escreve `powershell`, Enter).
2. Instala as dependências:
   ```
   npm install
   ```
3. Cria a tua chave de API:
   - Vai a https://console.anthropic.com, cria conta/entra, e gera uma chave de API (secção "API Keys").
   - Nesta pasta, copia o ficheiro `.env.example` e renomeia a cópia para `.env` (sem ".example").
   - Abre o `.env` com o Bloco de Notas e substitui `a-tua-chave-aqui` pela chave que copiaste.

## Como usar a app (sempre que quiseres abrir)

1. Abre o PowerShell dentro desta pasta.
2. Escreve:
   ```
   npm start
   ```
3. Deixa essa janela aberta (é o "motor" da app a correr).
4. Abre o browser e vai a: **http://localhost:3000**

A partir daqui, usa a app normalmente — os dados ficam guardados no browser desse PC (localStorage), e as partilhas por WhatsApp e pesquisas de receitas devem funcionar sem os problemas da versão de teste.

## Para usares a partir do telemóvel Android (opcional, mais tarde)

Esta versão só funciona no PC onde a instalaste (localhost = "este computador"). Para abrires no telemóvel a qualquer hora, sem o PC ligado, o passo seguinte é publicar a app num serviço gratuito como o Vercel ou o Netlify — nesse caso a chave de API deve ser configurada nas definições desse serviço (nunca colocada diretamente no código). Se quiseres avançar para isso, pede ajuda ao Claude Code ou volta ao chat do Claude.ai a pedir os passos.

## Sincronizar entre telemóvel, tablet e PC (código pessoal) — opcional

Por definição, os dados ficam só no aparelho onde os criaste. Se quiseres o mesmo plano e livro de receitas em vários aparelhos, usando um "código pessoal" (sem password), precisas de configurar uma base de dados gratuita:

1. Vai a https://supabase.com, cria conta gratuita, e cria um novo projeto.
2. Dentro do projeto, vai a **SQL Editor**, cola isto e executa ("Run"):
   ```sql
   create table user_data (
     code text primary key,
     data jsonb,
     updated_at timestamptz default now()
   );
   alter table user_data disable row level security;
   ```
3. Vai a **Project Settings > API**. Copia o **Project URL** e a chave **anon public**.
4. No `.env` local (ou nas Environment Variables do Render, se já tiveres publicado a app), adiciona:
   ```
   SUPABASE_URL=o-teu-project-url
   SUPABASE_KEY=a-tua-chave-anon-public
   ```
5. Reinicia a app (`npm start` de novo, ou espera o Render republicar sozinho).

A partir daí, ao abrires a app pela primeira vez, ela pede um "código pessoal" — cria um novo, guarda-o, e usa o mesmo código em qualquer outro aparelho para veres os mesmos dados.

## Se algo não funcionar

- **"npm não é reconhecido"**: o Node.js não ficou instalado corretamente, ou precisas de fechar e reabrir o PowerShell depois de instalar.
- **A pesquisa de receitas dá erro**: confirma que o ficheiro `.env` existe (não `.env.example`) e que a chave está correta, sem espaços a mais.
- **A porta 3000 já está em uso**: fecha outros programas que possam estar a usá-la, ou muda `PORT` no ficheiro `.env` para outro número (ex: 3001) e usa esse número no browser.
