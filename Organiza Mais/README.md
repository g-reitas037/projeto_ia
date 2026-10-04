
# Organiza+

> Manual de desenvolvimento do assistente financeiro inteligente.

## Visao geral

O Organiza+ e um prototipo web de planejamento financeiro pessoal. A aplicacao permite criar um perfil, informar renda e gastos fixos, receber um diagnostico financeiro e conversar com um assistente que gera respostas personalizadas.

O projeto e executado no navegador com HTML, CSS e JavaScript puro. Atualmente nao existe servidor, banco de dados ou pipeline de build.

## Requisitos

- Navegador moderno com suporte a JavaScript ES6+ e `localStorage`.
- Um servidor HTTP local recomendado para evitar restricoes ao abrir arquivos diretamente.
- Git, caso deseje contribuir com o codigo.

## Executar localmente

Na raiz do projeto, inicie um servidor HTTP simples. Com Python instalado:

```bash
python3 -m http.server 8000
```

Depois, abra `http://localhost:8000` no navegador. A entrada da aplicacao e `index.html`.

Tambem e possivel usar a extensao Live Server do VS Code ou outro servidor estatico equivalente.

## Estrutura do projeto

| Arquivo ou pasta | Responsabilidade |
| --- | --- |
| `index.html` | Pagina inicial, modal de cadastro/login e tela de perfil. |
| `script.js` | Cadastro, login, sessao, perfil, diagnostico, tutorial e persistencia. |
| `chat.html` | Estrutura da tela do chatbot e controles da barra lateral. |
| `chat.js` | Historico, tema, envio de mensagens e motor de respostas financeiras. |
| `style.css` | Estilos globais, home, cadastro e perfil. |
| `chat.css` | Estilos especificos da interface do chatbot. |
| `img/` | Imagens utilizadas pela interface. |
| `documentacao.md` | Proposta do sistema, fluxos e manual de utilizacao. |
| `PDF/` | Materiais complementares do projeto. |

## Fluxo tecnico

1. `index.html` carrega `script.js`.
2. O visitante cria uma conta ou entra em uma conta existente.
3. Os dados da conta sao gravados no `localStorage`.
4. O usuario preenche renda, gastos e perfil de investidor.
5. `script.js` calcula o diagnostico financeiro e atualiza a tela.
6. O link para `chat.html` abre o assistente.
7. `chat.js` recupera o usuario atual, carrega o historico e calcula respostas com base nos dados do perfil.

## Persistencia local

O prototipo usa estas chaves do `localStorage`:

| Chave | Conteudo |
| --- | --- |
| `organizamais_usuarios` | Objeto com as contas e os dados de cada usuario. |
| `organizamais_sessao` | E-mail do usuario atualmente autenticado. |
| `organizamais_chat_<email>` | Historico de mensagens do chat daquele usuario. |
| `aurafinance_theme` | Tema selecionado, `light` ou `dark`. |

Para limpar os dados durante o desenvolvimento, use as ferramentas do navegador em **Application/Storage > Local Storage** ou execute no console:

```javascript
localStorage.clear();
```

Essa operacao remove contas, sessao, preferencias e historico locais.

## Como alterar o motor de respostas

As respostas ficam na funcao `gerarRespostaFinanceira` em `chat.js`. O motor identifica palavras-chave e seleciona uma intencao. Para adicionar um novo tipo de resposta:

1. Crie uma nova condicao com as palavras-chave desejadas.
2. Leia os dados do usuario pelas variaveis ja calculadas, como `renda`, `gastos` e `margemLivre`.
3. Monte o retorno em HTML usando as classes visuais existentes, como `msg-highlight-box` e `msg-metrics-grid`.
4. Insira a nova condicao antes da resposta geral.
5. Adicione uma pergunta de exemplo em `chat.html`, se a funcionalidade merecer um atalho.
6. Teste com perfil preenchido e tambem com renda ou gastos ausentes.

O fluxo de RASA descrito em `documentacao.md` e conceitual. O prototipo atual processa as mensagens localmente em JavaScript e ainda nao possui integracao com um servidor RASA.

## Perfis financeiros

As regras dos perfis ficam em `PERFIS_CONFIG`, dentro de `chat.js`. Cada perfil define:

- Nome e classe visual do badge.
- Percentual da margem livre destinado a poupanca.
- Percentual permitido para gastos variaveis.
- Sugestao de alocacao.
- Diretriz apresentada pelo assistente.

Ao alterar esses valores, valide se a soma dos percentuais representa a regra financeira desejada e teste as respostas de teto de gastos, investimentos e reserva de emergencia.

## Boas praticas de manutencao

- Preserve os IDs usados pelos arquivos JavaScript, pois eles conectam o HTML ao comportamento da interface.
- Use `textContent` para textos fornecidos pelo usuario.
- Ao gerar HTML dinamico no chat, escape entradas externas antes de inseri-las na pagina.
- Mantenha as chaves de `localStorage` compatveis com dados ja existentes.
- Evite inserir credenciais reais: este projeto e um prototipo local.
- Atualize `documentacao.md` quando uma funcionalidade ou fluxo for alterado.

## Checklist de testes manuais

- Abrir a home e alternar entre tema claro e escuro.
- Criar uma conta com senha menor que 6 caracteres e confirmar a validacao.
- Criar uma conta valida e verificar o redirecionamento para `chat.html`.
- Sair e entrar novamente usando o mesmo e-mail.
- Editar dados pessoais, perfil, renda e gastos.
- Confirmar a atualizacao do diagnostico.
- Enviar uma pergunta pelo botao, por `Enter` e por uma pergunta rapida.
- Testar `Shift + Enter` para quebra de linha.
- Confirmar respostas de teto, investimentos, reserva, economia e simulacao.
- Limpar o historico e confirmar a acao.
- Verificar o layout em uma janela estreita.

## Limitacoes atuais

- Os dados ficam somente no navegador e nao sao sincronizados entre dispositivos.
- A autenticacao e adequada apenas para demonstracao local; nao substitui um back-end seguro.
- O motor de respostas usa regras e palavras-chave, nao um modelo de IA conectado.
- Graficos visuais e comparacoes historicas ainda dependem de uma futura camada de dados estruturados.
- O sistema nao deve ser usado como substituto de orientacao financeira profissional.

## Documentacao complementar

Consulte [documentacao.md](documentacao.md) para a proposta do sistema, os fluxogramas e o manual voltado ao usuario final.
