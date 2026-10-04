from typing import Any, Dict, Optional, Text
from rasa_sdk import Action, Tracker
import requests
import re

SUPABASE_URL = "https://mqeffskdahxrcfhzomgf.supabase.co"
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZWZmc2tkYWh4cmNmaHpvbWdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNzIwMDMsImV4cCI6MjEwNTk0ODAwM30.ADFp7a4os7OzvrM1J1zf4E9T6-GGJjDN1XBBDPFZnfk';

PERFIS_CONFIG = {
    "conservador": {"nome": "Conservador", "poupanca": 0.15, "variavel": 0.85},
    "moderado":    {"nome": "Moderado",    "poupanca": 0.25, "variavel": 0.75},
    "arrojado":    {"nome": "Arrojado",    "poupanca": 0.35, "variavel": 0.65},
}

ALOCACAO = {
    "conservador": [
        {"ativo": "Tesouro Selic / Reserva", "pct": 75},
        {"ativo": "CDB 100%+ CDI", "pct": 25},
    ],
    "moderado": [
        {"ativo": "Renda Fixa / Reserva", "pct": 50},
        {"ativo": "FIIs & IPCA+", "pct": 35},
        {"ativo": "Ações / Multimercado", "pct": 15},
    ],
    "arrojado": [
        {"ativo": "Ações & Dividendos", "pct": 45},
        {"ativo": "ETFs Globais & FIIs", "pct": 30},
        {"ativo": "Reserva de Oportunidade", "pct": 25},
    ],
}


def buscar_perfil(user_id: str):
    """Busca o perfil do usuário diretamente na API REST do Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/perfis"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    params = {
        "id": f"eq.{user_id}",
        "select": "*",
        "limit": "1"
    }
    r = requests.get(url, headers=headers, params=params, timeout=10)
    r.raise_for_status()
    dados = r.json()
    if not isinstance(dados, list):
        raise ValueError("Resposta inesperada ao consultar o perfil no Supabase.")
    return dados[0] if dados else None


def obter_perfil_usuario(tracker: Tracker) -> Optional[Dict[Text, Any]]:
    """Usa o perfil autenticado enviado pelo front; consulta o Supabase como fallback."""
    mensagem = tracker.latest_message
    metadata = mensagem.get("metadata") if isinstance(mensagem, dict) else None
    perfil = metadata.get("perfil_usuario") if isinstance(metadata, dict) else None

    if isinstance(perfil, dict) and {"renda", "gastos_fixos"}.issubset(perfil):
        return perfil

    return buscar_perfil(tracker.sender_id)


def brl(v: float) -> str:
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def env_chart(dispatcher, text, chart_type, title, labels, datasets, click_messages=None):
    """Envia uma mensagem de texto + um gráfico interativo."""
    dispatcher.utter_message(text=text)

    payload = {
        "type": "chart",
        "chart_type": chart_type,
        "title": title,
        "data": {
            "labels": labels,
            "datasets": datasets
        }
    }
    if click_messages:
        payload["clickMessages"] = click_messages

    dispatcher.utter_message(json_message=payload)

def calcular(perfil: dict):
    renda = float(perfil.get("renda") or 0)
    gastos = float(perfil.get("gastos_fixos") or 0)
    tipo = (perfil.get("perfil") or "moderado").lower()
    cfg = PERFIS_CONFIG.get(tipo, PERFIS_CONFIG["moderado"])
    margem = max(0, renda - gastos)
    return {
        "renda": renda,
        "gastos": gastos,
        "margem": margem,
        "poupanca": margem * cfg["poupanca"],
        "teto": margem * cfg["variavel"],
        "cfg": cfg,
        "tipo": tipo,
    }


def sem_dados_msg(dispatcher):
    dispatcher.utter_message(
        text="Você ainda não preencheu sua renda e gastos fixos no perfil. "
             "Acesse a aba de perfil no site para informar seus valores e eu poderei calcular tudo personalizado!"
    )


class ActionTetoGastos(Action):
    def name(self) -> Text:
        return "action_teto_gastos"

    def run(self, dispatcher, tracker, domain):
        perfil = obter_perfil_usuario(tracker)
        if not perfil or not perfil.get("renda") or not perfil.get("gastos_fixos"):
            sem_dados_msg(dispatcher)
            return []
        d = calcular(perfil)

        env_chart(
            dispatcher,
            text=(
                f"📊 Seu teto de gastos livres é {brl(d['teto'])}.\n\n"
                f"Como seu perfil é {d['cfg']['nome']}, dividi sua margem assim:\n"
                f"💡 Clique em uma fatia do gráfico para saber mais."
            ),
            chart_type="doughnut",
            title="Distribuição do Orçamento Mensal",
            labels=["Gastos Fixos", "Teto Variável", "Meta Poupança"],
            datasets=[{
                "data": [d["gastos"], d["teto"], d["poupanca"]],
                "backgroundColor": ["#869b8f", "#f59e0b", "#059669"],
                "borderWidth": 0,
            }],
            click_messages={
                "Gastos Fixos": "Como posso reduzir meus gastos fixos?",
                "Teto Variável": "Como devo controlar meus gastos variáveis?",
                "Meta Poupança": "Como devo investir minha meta de poupança?",
            }
        )
        return []


class ActionAlocacao(Action):
    def name(self) -> Text:
        return "action_alocacao_investimentos"

    def run(self, dispatcher, tracker, domain):
        perfil = obter_perfil_usuario(tracker)
        if not perfil:
            sem_dados_msg(dispatcher)
            return []
        d = calcular(perfil)
        linhas = [f"• {item['pct']}% em {item['ativo']}" for item in ALOCACAO.get(d["tipo"], [])]
        itens = ALOCACAO.get(d["tipo"], [])
        env_chart(
            dispatcher,
            text=f"📈 Para o perfil {d['cfg']['nome']}, esta é a alocação sugerida:",
            chart_type="pie",
            title="Carteira Recomendada",
            labels=[i["ativo"] for i in itens],
            datasets=[{
                "data": [i["pct"] for i in itens],
                "backgroundColor": ["#059669", "#3b82f6", "#f59e0b", "#ec4899"],
                "borderWidth": 0,
            }]
        )
        return []


class ActionReserva(Action):
    def name(self) -> Text:
        return "action_reserva_emergencia"

    def run(self, dispatcher, tracker, domain):
        perfil = obter_perfil_usuario(tracker)
        if not perfil or not perfil.get("gastos_fixos"):
            sem_dados_msg(dispatcher)
            return []
        gastos = float(perfil["gastos_fixos"])
        tipo = (perfil.get("perfil") or "moderado").lower()
        meses = 12 if tipo == "conservador" else 6
        ideal = gastos * meses
        dispatcher.utter_message(
            text=f"🛡️ Para o perfil {PERFIS_CONFIG[tipo]['nome']}, recomendo reserva de {meses} meses "
                 f"dos gastos essenciais:\n\n"
                 f"Meta da reserva: {brl(ideal)}\n"
                 f"Aplicar em Tesouro Selic ou CDB 100% CDI com liquidez diária."
        )
        return []


class ActionDicas(Action):
    def name(self) -> Text:
        return "action_dicas_economia"

    def run(self, dispatcher, tracker, domain):
        dispatcher.utter_message(
            text="✂️ 4 táticas para cortar gastos:\n\n"
                 "1. Cancele assinaturas que você não usou nos últimos 30 dias.\n"
                 "2. Renegocie internet, telefone e seguros pedindo planos promocionais.\n"
                 "3. Regra dos 3 dias: espere 72h antes de compras por impulso.\n"
                 "4. No dia do salário, separe a meta de poupança ANTES de gastar."
        )
        return []


class ActionSimulacao(Action):
    def name(self) -> Text:
        return "action_simulacao_poupanca"

    def run(self, dispatcher, tracker, domain):
        perfil = obter_perfil_usuario(tracker)
        if not perfil:
            sem_dados_msg(dispatcher)
            return []
        d = calcular(perfil)
        aporte = d["poupanca"] if d["poupanca"] > 0 else 300
        taxa = 0.0085

        def futuro(meses):
            total = 0.0
            for _ in range(meses):
                total = (total + aporte) * (1 + taxa)
            return total

        meses = list(range(0, 25))
        valores = [futuro(m) for m in meses]

        env_chart(
            dispatcher,
            text=f"🎯 Veja como sua poupança cresce investindo {brl(aporte)} por mês:",
            chart_type="line",
            title="Projeção de Poupança (24 meses)",
            labels=[f"{m}m" for m in meses],
            datasets=[{
                "label": "Patrimônio acumulado",
                "data": [round(v, 2) for v in valores],
                "borderColor": "#059669",
                "backgroundColor": "rgba(5, 150, 105, 0.15)",
                "fill": True,
                "tension": 0.3,
                "pointRadius": 0,
                "pointHoverRadius": 5,
            }]
        )
        return []

class ActionComparativo(Action):
    def name(self) -> Text:
        return "action_comparativo"

    def run(self, dispatcher, tracker, domain):
        perfil = obter_perfil_usuario(tracker)
        if not perfil:
            sem_dados_msg(dispatcher)
            return []
        d = calcular(perfil)

        env_chart(
            dispatcher,
            text="💰 Comparativo do seu orçamento mensal:",
            chart_type="bar",
            title="Renda x Gastos x Margem",
            labels=["Renda", "Gastos Fixos", "Margem Livre", "Teto Variável"],
            datasets=[{
                "label": "Valor (R$)",
                "data": [d["renda"], d["gastos"], d["margem"], d["teto"]],
                "backgroundColor": ["#059669", "#dc2626", "#3b82f6", "#f59e0b"],
                "borderRadius": 8,
                "borderWidth": 0,
            }]
        )
        return []

class ActionSaudacao(Action):
    def name(self) -> Text:
        return "action_saudacao"

    def run(self, dispatcher, tracker, domain):
        perfil = buscar_perfil(tracker.sender_id)

        # Caso 1: usuário ainda não preencheu os dados
        if not perfil or not perfil.get("renda") or not perfil.get("gastos_fixos"):
            dispatcher.utter_message(
                text="Olá! 👋 Sou a IA da Organiza+.\n\n"
                     "Ainda não tenho seus números completos, então não consigo "
                     "personalizar ainda. Se quiser, acesse a aba de perfil e "
                     "preencha sua renda e gastos fixos — em 1 minuto eu já consigo "
                     "te dar um diagnóstico completo.\n\n"
                     "Enquanto isso, posso te ajudar com dicas gerais de "
                     "organização, conceitos de investimento ou explicar como funciona "
                     "a reserva de emergência. O que prefere?"
            )
            return []

        # Caso 2: usuário com dados preenchidos → saudação contextual
        d = calcular(perfil)

        # Detecta se há "sinal de alerta" para avisar proativamente
        alertas = []
        if d["gastos"] > d["renda"] * 0.7:
            alertas.append(
                f"⚠️ Seus gastos fixos consomem "
                f"{(d['gastos']/d['renda']*100):.0f}% da renda — acima do "
                f"recomendado (60%). Vale renegociar contas."
            )

        if d["margem"] <= 0:
            alertas.append(
                "🚨 Sua margem livre está zerada ou negativa. Prioridade: "
                "reduzir gastos fixos para liberar espaço no orçamento."
            )

        # Sugestão de pergunta rápida
        sugestoes = []
        if d["margem"] > 0 and d["poupanca"] < 500:
            sugestoes.append("dicas para economizar")
        if not alertas:
            sugestoes.append("teto de gastos")
        sugestoes.append("como investir minha poupança")

        texto = (
            f"Olá! 👋 Voltamos aos números.\n\n"
            f"📊 **Resumo rápido do mês:**\n"
            f"• Margem livre: **{brl(d['margem'])}**\n"
            f"• Teto para gastos variáveis: **{brl(d['teto'])}**\n"
            f"• Meta de poupança sugerida: **{brl(d['poupanca'])}**\n"
        )

        if alertas:
            texto += "\n" + "\n".join(alertas)

        texto += (
            f"\n\nQuer que eu detalhe algo? Posso falar sobre "
            f"**{sugestoes[0]}**, **{sugestoes[1]}**, ou analisar se cabe uma "
            f"compra específica no orçamento."
        )

        dispatcher.utter_message(text=texto)
        return []

CONCEITOS = {
    "cdb": (
        "CDB (Certificado de Depósito Bancário)",
        "É um empréstimo que você faz ao banco. Em troca, ele te paga juros. "
        "CDBs com 'liquidez diária' podem ser resgatados a qualquer momento. "
        "Procure os que rendem pelo menos 100% do CDI."
    ),
    "cdi": (
        "CDI (Certificado de Depósito Interbancário)",
        "É a taxa de referência dos empréstimos entre bancos. Serve de base "
        "para praticamente toda a renda fixa. Quando dizem 'rende 100% do CDI', "
        "significa que o investimento acompanha essa taxa."
    ),
    "fii": (
        "FII (Fundo Imobiliário)",
        "É um fundo que investe em imóveis (shoppings, galpões, escritórios). "
        "Você recebe uma fatia dos aluguéis todo mês. É renda passiva — seu "
        "dinheiro trabalha sem você precisar gerenciar imóvel diretamente."
    ),
    "selic": (
        "Tesouro Selic",
        "Título público federal, o mais seguro do país. Rende perto da taxa "
        "Selic e tem liquidez diária. Ideal para a reserva de emergência."
    ),
    "tesouro direto": (
        "Tesouro Direto",
        "Programa do governo que permite a pessoas físicas comprar títulos "
        "públicos pela internet, a partir de ~R$ 30. Inclui Tesouro Selic, "
        "IPCA+ e Prefixado."
    ),
    "ipca": (
        "IPCA (Índice de Preços ao Consumidor Amplo)",
        "É o índice oficial de inflação do Brasil. Investimentos 'IPCA+' pagam "
        "a inflação do período mais uma taxa fixa, te protegendo da perda de "
        "poder de compra."
    ),
    "liquidez": (
        "Liquidez diária",
        "Significa que você pode resgatar o dinheiro no mesmo dia ou em até "
        "1 dia útil. Essencial para a reserva de emergência — imprevistos não "
        "avisam."
    ),
    "renda fixa": (
        "Renda Fixa",
        "Investimentos com regras de remuneração conhecidas desde o início "
        "(ex: '100% do CDI' ou 'IPCA + 5%'). Menor risco, retorno previsível. "
        "Inclui CDB, Tesouro Direto, LCI, LCA."
    ),
    "renda variável": (
        "Renda Variável",
        "Investimentos cujo retorno não é previsível (ações, FIIs, ETFs, "
        "criptomoedas). Maior potencial de ganho, maior oscilação. Ideal para "
        "horizonte longo e após ter reserva de emergência formada."
    ),
    "etf": (
        "ETF (Exchange Traded Fund)",
        "É uma 'cesta' de ativos negociada em bolsa como uma ação. Por exemplo, "
        "um ETF de S&P 500 replica as 500 maiores empresas dos EUA. Diversificação "
        "com uma única compra."
    ),
    "juros compostos": (
        "Juros compostos",
        "São juros que rendem sobre juros anteriores. É o motor do crescimento "
        "patrimonial de longo prazo. Ex: R$ 1.000 a 10% a.a. viram R$ 2.594 em "
        "10 anos — sem aporte novo, só pelo efeito composto."
    ),
    "reserva de emergência": (
        "Reserva de Emergência",
        "É um valor guardado para imprevistos (desemprego, saúde, reparos), "
        "equivalente a 6 a 12 meses dos seus gastos essenciais. Deve ficar em "
        "ativo com liquidez diária e risco mínimo (Tesouro Selic ou CDB 100% CDI)."
    ),
}


class ActionConceito(Action):
    def name(self) -> Text:
        return "action_conceito"

    def run(self, dispatcher, tracker, domain):
        texto = tracker.latest_message.get("text", "").lower()

        # Ordena por tamanho decrescente para priorizar chaves compostas
        # (ex: "reserva de emergência" antes de "reserva")
        chaves = sorted(CONCEITOS.keys(), key=len, reverse=True)
        for chave in chaves:
            if chave in texto:
                titulo, explica = CONCEITOS[chave]
                dispatcher.utter_message(text=f"📚 **{titulo}**\n\n{explica}")
                return []

        dispatcher.utter_message(
            text="Sobre qual conceito você quer saber? Exemplos: CDB, CDI, FII, "
                 "Tesouro Selic, IPCA, liquidez diária, renda fixa, renda variável, "
                 "ETF, juros compostos ou reserva de emergência."
        )
        return []

def extrair_valor_numerico(texto: str):
    """Extrai o primeiro número de uma frase. Aceita '3000', '2.500', '1.200,50'."""
    # Normaliza: remove pontos de milhar e troca vírgula decimal por ponto
    matches = re.findall(r'\d+(?:[.,]\d+)?', texto)
    for m in matches:
        # Se tem vírgula e ponto, remove os pontos e troca a vírgula por ponto
        if ',' in m and '.' in m:
            v = m.replace('.', '').replace(',', '.')
        elif ',' in m:
            v = m.replace(',', '.')
        else:
            v = m
        try:
            return float(v)
        except ValueError:
            continue
    return None


def extrair_item(texto: str):
    """Tenta extrair o substantivo da compra (heurística simples)."""
    # Palavras-chave comuns — expanda conforme necessário
    itens_conhecidos = [
        "celular", "smartphone", "iphone", "tv", "televisão", "notebook",
        "laptop", "computador", "tablet", "bicicleta", "carro", "moto",
        "motocicleta", "viagem", "passagem", "geladeira", "fogão", "sofá",
        "tênis", "sapato", "roupa", "curso", "livro", "móvel", "cama",
        "ar-condicionado", "ventilador", "fone", "headphone", "relógio",
        "câmera", "console", "videogame", "playstation", "xbox"
    ]
    texto_lower = texto.lower()
    for item in itens_conhecidos:
        if item in texto_lower:
            return item.capitalize()
    return None


class ActionPossoComprar(Action):
    def name(self) -> Text:
        return "action_posso_comprar"

    def run(self, dispatcher, tracker, domain):
        perfil = buscar_perfil(tracker.sender_id)
        if not perfil or not perfil.get("renda") or not perfil.get("gastos_fixos"):
            sem_dados_msg(dispatcher)
            return []

        texto = tracker.latest_message.get("text", "")

        # 1) Tenta pegar valor via slot (se o DIET extraiu)
        valor = tracker.get_slot("valor")

        # 2) Se não veio, extrai via regex do próprio texto
        if not valor:
            valor = extrair_valor_numerico(texto)

        if not valor or valor <= 0:
            dispatcher.utter_message(
                text="Claro! Me diga o **valor aproximado** da compra e eu analiso. "
                     "Exemplo: *'posso comprar uma TV de 2500?'*"
            )
            return []

        # 3) Item: tenta pelo slot, senão pela heurística
        item = tracker.get_slot("item") or extrair_item(texto) or "essa compra"

        # 4) Cálculo
        d = calcular(perfil)
        teto = d["teto"]
        margem = d["margem"]

        if teto <= 0 or margem <= 0:
            dispatcher.utter_message(
                text="Sua margem livre está zerada, então qualquer compra "
                     "extra vai apertar o orçamento. Antes de comprar, vale "
                     "renegociar seus gastos fixos. Quer que eu te dê ideias?"
            )
            return []

        # 5) Regra de decisão + veredito
        pct_teto = (valor / teto) * 100
        pct_margem = (valor / margem) * 100

        if pct_teto <= 30:
            veredito = "✅ **Cabe tranquilo.**"
            detalhe = (
                f"Essa compra consome apenas **{pct_teto:.0f}%** do seu teto "
                f"de gastos variáveis do mês. Sobrariam {brl(teto - valor)} "
                f"para o resto das despesas variáveis."
            )
            dica = None
        elif pct_teto <= 100:
            veredito = "⚠️ **Cabe, mas com atenção.**"
            detalhe = (
                f"Isso vai consumir **{pct_teto:.0f}%** do seu teto. "
                f"Sobrariam {brl(teto - valor)} para o resto do mês — "
                f"vale segurar os gastos nas próximas semanas."
            )
            dica = "Dica: tente esperar 3 dias antes de fechar a compra. Se ainda fizer sentido, provavelmente é uma boa decisão."
        elif valor <= margem:
            veredito = "🚨 **Compra grande para o mês.**"
            detalhe = (
                f"O valor ultrapassa o teto variável e compromete "
                f"**{pct_margem:.0f}%** da sua margem livre total "
                f"({brl(margem)})."
            )
            parcelas = 3
            dica = (
                f"Sugestão: parcele ou divida em {parcelas}x, "
                f"guardando cerca de {brl(valor / parcelas)} por mês."
            )
        else:
            veredito = "❌ **Não cabe no orçamento atual.**"
            detalhe = (
                f"Esse valor ({brl(valor)}) é maior que sua margem livre total "
                f"({brl(margem)}). Financiar ou parcelar comprometeria demais."
            )
            meses_para_juntar = int(valor / d["poupanca"]) if d["poupanca"] > 0 else None
            dica = (
                f"Alternativa: guarde a meta de poupança de {brl(d['poupanca'])}/mês "
                f"e em ~{meses_para_juntar} meses você compra à vista sem dívida."
                if meses_para_juntar else
                "Alternativa: primeiro aumente sua margem livre reduzindo gastos fixos."
            )

        texto_resposta = (
            f"{veredito}\n\n"
            f"Sobre **{item}** no valor de **{brl(valor)}**:\n\n"
            f"• Seu teto de gastos variáveis: {brl(teto)}\n"
            f"• Sua margem livre total: {brl(margem)}\n"
            f"• Compra representa: {pct_teto:.0f}% do teto variável\n\n"
            f"{detalhe}"
        )

        if dica:
            texto_resposta += f"\n\n💡 {dica}"

        dispatcher.utter_message(text=texto_resposta)
        return []