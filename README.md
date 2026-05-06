# 📱 Gestor de Polos & Amigos

## 📝 Visão Geral
Este aplicativo é uma solução **Offline-First** desenvolvida com **Apache Cordova**, projetada especificamente para organizar redes de contatos e interações sociais de forma hierárquica. O software permite o mapeamento de pessoas influentes (**Polos**) e das pessoas apresentadas por elas (**Amigos**), gerenciando o histórico de interações através de um sistema integrado de **Visitas** e **Tarefas**.

O diferencial deste projeto é a sua interface adaptada para usuários que buscam simplicidade, com botões de fácil clique, cores vibrantes para identificação rápida de status e total funcionamento sem dependência de conexão com a internet.

---

## 🏛️ Regras de Negócio e Arquitetura de Dados

O núcleo do aplicativo reside na relação de interdependência entre suas entidades. Abaixo, detalhamos o funcionamento de cada pilar:

### 1. A Hierarquia de Pessoas (Polo vs. Amigo)
O sistema não trata todos os contatos da mesma forma, separando-os por nível de influência no círculo social do usuário:

* **Entidade Polo:** * Representa o "nó central", ou seja, o amigo próximo ou contato de confiança que introduz o usuário a novos círculos.
    * **Regra:** Um Polo é uma entidade independente. Ele não pode estar vinculado a outro Polo.
    * **Atributos:** Nome (obrigatório), Telefone, Endereço, Data de Nascimento e Observações.
    * **Visualização:** Exibido em **Grade (Grid)** com fotos circulares para rápido reconhecimento visual.

* **Entidade Amigo:**
    * Representa a pessoa que foi apresentada ao usuário através de um Polo.
    * **Regra de Vínculo:** Todo Amigo deve, obrigatoriamente, estar associado a um único Polo no momento do cadastro.
    * **Hierarquia:** Um Polo pode possuir inúmeros Amigos, mas um Amigo pertence estritamente a um Polo (Relação 1:N).
    * **Visualização:** Exibido em **Lista Simples** vertical para otimizar a leitura de grandes volumes de nomes.

### 2. Gestão de Interações (Visitas)
As visitas são o registro histórico do relacionamento.
* **Vínculo:** Uma visita pode ser registrada tanto para um Polo quanto para um Amigo.
* **Campos:** Motivo da visita, Data (via calendário dinâmico), Pessoa Visitada e Observações.
* **Regra de Dashboard:** O sistema calcula automaticamente o total de visitas realizadas. Uma visita é considerada "Realizada" se a data for menor ou igual à data atual do sistema.

### 3. Planejamento de Ações (Tarefas)
As tarefas garantem que o compromisso firmado durante uma interação não seja esquecido.
* **Origem:** Uma tarefa pode ser criada de forma avulsa ou ser derivada de uma visita.
* **Automação:** Ao visualizar uma visita, o usuário pode clicar em "Criar Tarefa". O sistema herda automaticamente a "Pessoa Envolvida" daquela visita, facilitando o fluxo de trabalho.
* **Regra de Status:** Tarefas possuem dois estados: **Pendente** ou **Concluído**. Tarefas pendentes com prazo vencido recebem destaque visual na cor vermelha.

---

## 🎨 Identidade Visual e Interface (UI/UX)

O aplicativo utiliza uma paleta de cores funcional, onde a cor comunica o status do dado:

* 🔵 **Azul (#0a5ecf):** Representa a base sólida (Polos) e a navegação principal.
* 🌐 **Azul Claro (#41b7ff):** Identifica os Amigos e elementos de suporte.
* 🟢 **Verde (#01bc62):** Indica ações positivas, visitas concluídas e sucesso.
* 🔴 **Vermelho (#ad0b0b):** Alerta para pendências, tarefas atrasadas e ações críticas.

### Componentes de Interface
* **Dashboard Dinâmico:** A tela inicial processa queries SQL de contagem para exibir em tempo real o tamanho da rede e o volume de obrigações.
* **Calendário Flatpickr:** Substitui seletores padrão por um componente dinâmico que facilita a escolha de datas em telas de toque.
* **SPA (Single Page Application):** O app não sofre recarregamentos. As trocas de tela são geridas por JavaScript, proporcionando uma experiência idêntica a de um aplicativo nativo.

---

## 🛠️ Especificações Técnicas

* **Framework Base:** Apache Cordova (Híbrido).
* **Interface:** Bootstrap 5 (Customizado via CSS3).
* **Banco de Dados:** SQLite (Plugin `cordova-sqlite-storage`).
* **Armazenamento:** Local (os dados nunca saem do dispositivo do usuário).
* **Compatibilidade:** Inicialmente focado em Android (SDK 34+).

---

## 📋 Fluxo de Utilização Padrão

1.  **Início:** O usuário visualiza os números de sua rede no Dashboard.
2.  **Expansão:** Cadastra um **Polo** (Amigo Próximo) com sua foto.
3.  **Conexão:** Dentro do perfil do Polo, cadastra os **Amigos** que lhe foram apresentados.
4.  **Interação:** Registra uma **Visita** realizada a um desses contatos.
5.  **Acompanhamento:** Gera uma **Tarefa** a partir dessa visita para garantir um retorno futuro.
6.  **Conclusão:** Marca a tarefa como concluída diretamente na lista de tarefas.

---

## 🛡️ Segurança e Backup
Como o aplicativo opera de forma estritamente offline:
* Os dados são armazenados em um arquivo `.db` interno ao aplicativo.
* **Importante:** A desinstalação do aplicativo remove o banco de dados. 
* Recomenda-se o backup manual do dispositivo para preservação das informações em caso de troca de aparelho.

---
*Desenvolvido com foco em acessibilidade, robustez e simplicidade.*