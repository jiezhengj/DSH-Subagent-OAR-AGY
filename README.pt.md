# Instalação

1. Abra o gerenciamento de plugins do DeepSeek Harness (Configurações → Plugins).
2. Cole isto no campo de instalação e instale:

```
@jiezhengj/subagent-oar-agy
```

Fallback (tgz): `https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.2.8/subagent-oar-agy-0.2.8.tgz`

3. Ative «Subagente AGY»; o modelo poderá chamar `subagent_oar_agy` em uma nova sessão.
4. Recarregue o DSH quando solicitado (reinicie se necessário) e chame `subagent_oar_agy` em uma nova sessão.

Requisitos: DSH 0.2.2-rc.1 ou superior (abaixo de 0.3.0), CLI do Antigravity (`agy`) instalada e com login feito localmente. O tarball inclui o código de runtime deste plugin; a ferramenta OAR oficial é instalada do npm.

# Migrar de uma instalação tgz para o nome

Um perfil instalado a partir de um tgz não consegue procurar atualizações. Remova a entrada antiga no gerenciamento de plugins (ou execute `dsh plugin remove @jiezhengj/subagent-oar-agy`) e instale pelo nome acima; a configuração do plugin normalmente é preservada; se for removida com a entrada antiga, insira novamente suas configurações anteriores. A seção de versão passará a mostrar a versão atual e «Atualizado», permitindo atualizações no app.

# O que este plugin faz

Delega tarefas independentes à CLI local do Antigravity (`agy`): o modelo chama `subagent_oar_agy`, o plugin inicia `agy --input-format stream-json --output-format stream-json`, interpreta o fluxo NDJSON e devolve a resposta final ao DSH.

- Reutiliza a implementação e a forma da ferramenta OAR oficial (`runtime`/`description`/`prompt`/`cwd`, `runtime` apenas `agy`); aqui só é implementado o runtime AGY sem ACP.
- Coexiste com o bundle OAR oficial: a ferramenta aqui é `subagent_oar_agy`, a oficial é `subagent_oar`.
- Nome exibido, descrição, documentos de detalhe e mensagens de runtime em 8 idiomas de interface (de/en/es/fr/ja/pt/ru/zh).

# Configuração

Via patch do perfil (sem tela de configurações própria):

```yaml
- id: subagent-agy
  config:
    permissionMode: yolo   # yolo (padrão) / plan / strict
    timeoutMs: 600000      # opcional
    locale: auto           # auto ou de/en/es/fr/ja/pt/ru/zh
    command: agy           # opcional: caminho absoluto do agy
```

- `yolo`: sem supervisão; `plan`: planejamento somente leitura; `strict`: ações que exigem permissão são negadas automaticamente e o resultado traz uma nota visível.

# Instalação alternativa

```bash
dsh plugin add @jiezhengj/subagent-oar-agy
```

Ou compile a partir deste repositório:

```bash
pnpm install
pnpm -r build
cd packages/subagent-oar-agy-bundle && pnpm pack
```

# Estrutura do repositório

- `packages/subagent-oar-agy-provider/`: provedor do runtime AGY (subprocesso, fluxo de eventos, timeout/cancelamento, mensagens i18n).
- `packages/subagent-oar-agy-bundle/`: bundle DSH distribuível (manifesto, patch, metadados e detalhes em 8 idiomas, provedor embutido na compilação).
- `specs/001-subagent-oar-agy/`: especificação SDD, plano, tarefas e validação.

# Desenvolvimento

```bash
pnpm install
pnpm -r build
pnpm test
```

# Aviso

Wrapper não oficial, sem vínculo com DeepSeek ou Google. Use por sua conta e risco e siga os termos do Antigravity.
