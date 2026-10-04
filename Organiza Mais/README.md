
# Organiza+

> Manual de desenvolvimento do assistente financeiro inteligente.

## Visao geral

O Organiza+ e um prototipo web de planejamento financeiro pessoal. A aplicacao permite criar um perfil, informar renda e gastos fixos, receber um diagnostico financeiro e conversar com um assistente que gera respostas personalizadas.

O front-end e executado no navegador com HTML, CSS e JavaScript. A autenticacao e a persistencia usam Supabase; o assistente pode se conectar ao servidor Rasa incluido em `organiza-rasa/` e mantem respostas locais como alternativa.

## Requisitos

- Navegador moderno com suporte a JavaScript ES6+ e `localStorage`.
- Um servidor HTTP local recomendado para evitar restricoes ao abrir arquivos diretamente.
- Git, caso deseje contribuir com o codigo.

## Executar localmente

Na raiz desta pasta, inicie um servidor HTTP simples. Com Python instalado:

```bash
python3 -m http.server 8000
```

Depois, abra `http://localhost:8000` no navegador. A entrada da aplicacao e `index.html`.

Tambem e possivel usar a extensao Live Server do VS Code ou outro servidor estatico equivalente.

## Executar o Rasa

O servidor Rasa habilita classificacao de intencoes, acoes personalizadas e graficos. O projeto usa Rasa 3.6.21, Python 3.10 e o SDK 3.6.2. Se o servidor nao estiver disponivel, o chat tenta usar o motor local de respostas; esse modo nao gera os graficos do Rasa.

Em um terminal, entre em `organiza-rasa`, ative o ambiente Python onde Rasa foi instalado e inicie o servidor:

```bash
cd organiza-rasa
source ~/.venvs/organiza-rasa/bin/activate
rasa run --enable-api --cors "*" --port 5005
```

Os modelos treinados ja estao em `organiza-rasa/models/`. Execute `rasa train` nesse diretorio somente depois de alterar os dados ou a configuracao do assistente.

Em outro terminal, no mesmo diretorio e ambiente, inicie as acoes personalizadas:

```bash
cd organiza-rasa
source ~/.venvs/organiza-rasa/bin/activate
rasa run actions
```

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
| `organiza-rasa/` | Configuracao, dados, modelos e acoes personalizadas do chatbot Rasa. |
| `LICENSE` | Licenca MIT do projeto. |

## Fluxo tecnico

1. `index.html` carrega `script.js`.
2. Cadastro e login sao autenticados pelo Supabase; o perfil financeiro e salvo na tabela `perfis`.
3. `script.js` calcula o diagnostico a partir da renda, dos gastos fixos e do perfil de investidor.
4. O link para `chat.html` abre o assistente para usuarios autenticados.
5. `chat.js` carrega `historico_chat`, envia mensagens ao Rasa e renderiza texto ou graficos. Se a chamada falhar, usa respostas locais por palavras-chave.

## Persistencia local

Somente a preferencia visual e gravada diretamente no `localStorage`:

| Chave | Conteudo |
| --- | --- |
| `aurafinance_theme` | Tema selecionado, `light` ou `dark`. |

Contas e sessoes ficam no Supabase Auth; perfis e historicos ficam nas tabelas `perfis` e `historico_chat`. Para redefinir apenas o tema durante o desenvolvimento, execute no console:

```javascript
localStorage.removeItem('aurafinance_theme');
```

Sair da conta nao apaga o perfil nem o historico remoto.

## Como alterar o motor de respostas

As respostas do modo local ficam na funcao `gerarRespostaFinanceira` em `chat.js`; ela e usada quando o webhook Rasa falha. Para adicionar uma resposta local:

1. Crie uma nova condicao com as palavras-chave desejadas.
2. Leia os dados do usuario pelas variaveis ja calculadas, como `renda`, `gastos` e `margemLivre`.
3. Monte o retorno em HTML usando as classes visuais existentes, como `msg-highlight-box` e `msg-metrics-grid`.
4. Insira a nova condicao antes da resposta geral.
5. Adicione uma pergunta de exemplo em `chat.html`, se a funcionalidade merecer um atalho.
6. Teste com perfil preenchido e tambem com renda ou gastos ausentes.

Para respostas processadas pelo Rasa, atualize a intencao em `organiza-rasa/data/nlu.yml`, a regra ou historia correspondente, a acao em `organiza-rasa/actions/actions.py` e o dominio. Treine um novo modelo e teste com os dois servidores ativos.

O fluxo de Rasa e configurado em `organiza-rasa/`. O front-end espera o servidor de conversas na porta `5005` e o servidor de acoes na porta `5055`.

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
- Testar perguntas processadas pelo Rasa e a alternativa local com os servidores desligados.
- Confirmar a exibicao, interacao e download dos graficos de teto, alocacao e simulacao.
- Limpar o historico e confirmar a acao.
- Verificar o layout em uma janela estreita.

## Limitacoes atuais

- A autenticacao e a persistencia dependem do projeto Supabase e de politicas RLS configuradas corretamente.
- A classificacao de intencoes e os graficos do assistente dependem dos servidores Rasa (portas `5005` e `5055`); o fallback local e limitado a palavras-chave.
- O assistente nao usa um modelo de linguagem generativo e nao mantem historico de transacoes ou comparacoes entre periodos.
- O sistema nao deve ser usado como substituto de orientacao financeira profissional.

## Documentacao complementar

Consulte [documentacao.md](documentacao.md) para o manual do usuario, os fluxos, a arquitetura e os requisitos de configuracao.
