# Documentacao do Sistema

## Proposta do sistema

O sistema sera uma plataforma inteligente de apoio ao planejamento e ao controle financeiro pessoal. A proposta combina um chatbot inteligente com um assistente virtual capaz de interpretar dados financeiros e apresentar informacoes uteis para a tomada de decisoes.

Principais funcionalidades:

- Chatbot inteligente para interacao com o usuario.
- Assistente virtual para orientar o usuario em suas tarefas financeiras.
- Geracao de graficos para facilitar a visualizacao dos dados.
- Comparacoes financeiras entre periodos, categorias ou cenarios.
- Elaboracao de plano de gastos personalizado.
- Controle do fluxo de entradas e saidas financeiras.

## Fluxograma da IA

```mermaid
flowchart TD
    A([Usuario]) --> B[RASA<br/>Interpretacao da mensagem]
    B --> C[(Entrada de dados)]
    C --> D[Analise de dados<br/>Processamento financeiro]
    D --> E{Tipo de solicitacao}

    subgraph R1[Ramo de visualizacao]
        E -->|Grafico| F[Gerar graficos]
    end

    subgraph R2[Ramo de comparacao]
        E -->|Comparacao| G[Comparar dados financeiros]
    end

    subgraph R3[Ramo de planejamento]
        E -->|Planejamento| H[Montar plano de gastos]
    end

    subgraph R4[Ramo de controle]
        E -->|Fluxo financeiro| I[Controlar entradas e saidas]
    end

    F --> J[Entrega de informacoes]
    G --> J
    H --> J
    I --> J
    J --> K([Resposta ao usuario])

    style R1 color:#000
    style R2 color:#000
    style R3 color:#000
    style R4 color:#000
    style A fill:#e8f1ff,stroke:#2563eb,stroke-width:2px,color:#000
    style B fill:#fff4d6,stroke:#d97706,stroke-width:2px,color:#000
    style C fill:#e8f8ee,stroke:#16a34a,stroke-width:2px,color:#000
    style D fill:#f3e8ff,stroke:#9333ea,stroke-width:2px,color:#000
    style E fill:#fef3c7,stroke:#ca8a04,stroke-width:2px,color:#000
    style F color:#000
    style G color:#000
    style H color:#000
    style I color:#000
    style J fill:#dbeafe,stroke:#1d4ed8,stroke-width:2px,color:#000
    style K fill:#dcfce7,stroke:#15803d,stroke-width:2px,color:#000
```

### Etapas do fluxo

1. **RASA:** recebe e interpreta as mensagens do usuario.
2. **Entrada de dados:** coleta as informacoes necessarias para a solicitacao.
3. **Analise de dados:** processa os dados financeiros e identifica resultados ou padroes.
4. **Entrega de informacoes:** apresenta a resposta, os graficos, as comparacoes ou o plano de gastos ao usuario.

## Jornada do usuario

```mermaid
flowchart TD
    A([SITE]) --> B[Home]
    B --> C{Possui cadastro?}

    subgraph RS[Usuario cadastrado]
        C -->|Sim| D[Pagina do usuario]
        D --> F[Usuario acessa o sistema]
    end

    subgraph RN[Usuario nao cadastrado]
        C -->|Nao| E[Chatbot]
        E --> F
    end

    F --> G[Funcionalidades financeiras]
    G --> H([Graficos, comparacoes e plano de gastos])

    style RS color:#000
    style RN color:#000
    style A fill:#e8f1ff,stroke:#2563eb,stroke-width:2px,color:#000
    style B fill:#dbeafe,stroke:#1d4ed8,stroke-width:2px,color:#000
    style C fill:#fef3c7,stroke:#ca8a04,stroke-width:2px,color:#000
    style D fill:#dcfce7,stroke:#15803d,stroke-width:2px,color:#000
    style E fill:#fff4d6,stroke:#d97706,stroke-width:2px,color:#000
    style F fill:#f3e8ff,stroke:#9333ea,stroke-width:2px,color:#000
    style G fill:#e8f8ee,stroke:#16a34a,stroke-width:2px,color:#000
    style H fill:#dcfce7,stroke:#15803d,stroke-width:2px,color:#000
```

### Etapas da jornada

1. O usuario acessa o **site**.
2. Na **home**, escolhe como deseja continuar.
3. O sistema verifica se o usuario possui cadastro.
4. Se a resposta for **sim**, o usuario acessa a pagina do usuario.
5. Se a resposta for **nao**, o usuario e direcionado ao chatbot.
6. O usuario interage com o sistema e acessa as funcionalidades financeiras disponiveis.
