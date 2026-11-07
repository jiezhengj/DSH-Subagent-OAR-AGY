/** 面向用户的运行时文案：与 DSH 界面一致的 8 种语言。 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** 与 DSH 界面语言一一对应的语言集合。 */
export type Locale = 'de' | 'en' | 'es' | 'fr' | 'ja' | 'pt' | 'ru' | 'zh'

/** 支持的语言列表（顺序与 DSH 一致）。 */
export const LOCALES: readonly Locale[] = ['de', 'en', 'es', 'fr', 'ja', 'pt', 'ru', 'zh']

/** 运行时可见文案键。 */
export interface Messages {
  notInstalled: string
  notAuthenticated: string
  timeout: string
  spawnFailed: string
  protocol: string
  malformedLines: string
  cancelled: string
  textRequired: string
  permissionDenied: string
  permissionToolFallback: string
  detailLabel: string
}

/** 八种语言的文案表。 */
export const MESSAGES: Record<Locale, Messages> = {
  de: {
    notInstalled: 'AGY ist nicht installiert oder nicht im PATH. Installieren Sie die Antigravity CLI oder setzen Sie command auf den absoluten Pfad von agy.',
    notAuthenticated: 'AGY erfordert eine Anmeldung. Führen Sie agy einmal in einem Terminal aus, um die interaktive Anmeldung abzuschließen, und versuchen Sie es erneut.',
    timeout: 'Zeitüberschreitung bei der Delegierung; der AGY-Prozess wurde beendet. Erhöhen Sie timeoutMs oder grenzen Sie die Aufgabe ein.',
    spawnFailed: 'Der AGY-Prozess konnte nicht gestartet werden. Prüfen Sie den command-Pfad, den Zugriff auf cwd und die Ausführungsrechte.',
    protocol: 'Die Ausgabe von AGY konnte nicht gelesen werden oder enthielt kein Endergebnis. Prüfen Sie die AGY-Version und mögliche Störungen der Ausgabe.',
    malformedLines: 'Die Ausgabe von AGY enthielt nicht lesbare Zeilen.',
    cancelled: 'Die Delegierung wurde abgebrochen (AGY-Prozess beendet; die übergeordnete Sitzung kann fortfahren).',
    textRequired: 'Eine Delegierung muss Text enthalten (die AGY-Laufzeit akzeptiert keine reinen Bild- oder strukturierten Eingaben).',
    permissionDenied: '[subagent-agy] Berechtigungsmodus {mode}: AGY hat Aktionen, die eine Berechtigung erfordern, automatisch abgelehnt ({tools}); es wurden keine Änderungen vorgenommen. Um sie zu erlauben, setzen Sie permissionMode auf yolo oder ergänzen Sie allow-Regeln in AGY settings.json.',
    permissionToolFallback: 'Werkzeuge mit Berechtigungsbedarf',
    detailLabel: 'Details',
  },
  en: {
    notInstalled: 'AGY is not installed or not on PATH. Install the Antigravity CLI, or set command to the absolute path of agy.',
    notAuthenticated: 'AGY needs you to sign in first. Run agy once in a terminal to complete the interactive login, then retry the delegation.',
    timeout: 'The delegation timed out and the AGY process was terminated. Increase timeoutMs or narrow the task and retry.',
    spawnFailed: 'Could not start the AGY process. Check the command path, that cwd is accessible, and the execute permission.',
    protocol: 'AGY output could not be parsed or had no final result. Check the AGY version and whether another program interferes with its output.',
    malformedLines: 'AGY output contained lines that could not be parsed.',
    cancelled: 'The delegation was cancelled (the AGY process was terminated; the parent session can continue).',
    textRequired: 'A delegation must contain text (the AGY runtime does not accept image-only or structured input).',
    permissionDenied: '[subagent-agy] Permission mode {mode}: AGY automatically denied actions that need permission ({tools}); no changes were made. To allow them, set permissionMode to yolo or add allow rules in AGY settings.json.',
    permissionToolFallback: 'tools that need permission',
    detailLabel: 'Detail',
  },
  es: {
    notInstalled: 'AGY no está instalado o no está en PATH. Instala la CLI de Antigravity o define command con la ruta absoluta de agy.',
    notAuthenticated: 'AGY necesita que inicies sesión. Ejecuta agy una vez en una terminal para completar el inicio de sesión interactivo y vuelve a intentarlo.',
    timeout: 'La delegación agotó el tiempo de espera y el proceso de AGY se terminó. Aumenta timeoutMs o divide la tarea.',
    spawnFailed: 'No se pudo iniciar el proceso de AGY. Revisa la ruta de command, el acceso a cwd y los permisos de ejecución.',
    protocol: 'No se pudo interpretar la salida de AGY o faltaba el resultado final. Revisa la versión de AGY y posibles interferencias en su salida.',
    malformedLines: 'La salida de AGY contenía líneas que no se pudieron interpretar.',
    cancelled: 'La delegación se canceló (el proceso de AGY terminó; la sesión principal puede continuar).',
    textRequired: 'Una delegación debe contener texto (el runtime de AGY no acepta entradas solo de imagen o estructuradas).',
    permissionDenied: '[subagent-agy] Modo de permisos {mode}: AGY denegó automáticamente las acciones que requieren permiso ({tools}); no se aplicó ningún cambio. Para permitirlas, cambia permissionMode a yolo o añade reglas allow en settings.json de AGY.',
    permissionToolFallback: 'herramientas que requieren permiso',
    detailLabel: 'Detalle',
  },
  fr: {
    notInstalled: "AGY n'est pas installé ou n'est pas dans le PATH. Installez la CLI Antigravity ou définissez command avec le chemin absolu d'agy.",
    notAuthenticated: "AGY doit d'abord être connecté. Lancez agy une fois dans un terminal pour terminer la connexion interactive, puis réessayez.",
    timeout: 'La délégation a expiré et le processus AGY a été arrêté. Augmentez timeoutMs ou ciblez davantage la tâche.',
    spawnFailed: "Impossible de démarrer le processus AGY. Vérifiez le chemin command, l'accès à cwd et les droits d'exécution.",
    protocol: "La sortie d'AGY n'a pas pu être lue ou ne contenait pas de résultat final. Vérifiez la version d'AGY et d'éventuelles interférences.",
    malformedLines: "La sortie d'AGY contenait des lignes illisibles.",
    cancelled: 'La délégation a été annulée (processus AGY arrêté ; la session parente peut continuer).',
    textRequired: "Une délégation doit contenir du texte (le runtime AGY n'accepte pas les entrées image seules ou structurées).",
    permissionDenied: "[subagent-agy] Mode d'autorisation {mode} : AGY a automatiquement refusé les actions nécessitant une autorisation ({tools}) ; aucune modification n'a été appliquée. Pour les autoriser, passez permissionMode à yolo ou ajoutez des règles allow dans settings.json d'AGY.",
    permissionToolFallback: 'outils nécessitant une autorisation',
    detailLabel: 'Détail',
  },
  ja: {
    notInstalled: 'AGY が見つかりません（未インストールまたは PATH 外）。Antigravity CLI をインストールするか、command に agy の絶対パスを指定してください。',
    notAuthenticated: 'AGY は先にログインが必要です。ターミナルで agy を一度実行して対話ログインを完了してから、もう一度委任してください。',
    timeout: '委任がタイムアウトし、AGY プロセスを終了しました。timeoutMs を増やすか、タスクを絞って再試行してください。',
    spawnFailed: 'AGY プロセスを起動できませんでした。command のパス、cwd へのアクセス、実行権限を確認してください。',
    protocol: 'AGY の出力を解析できないか、最終結果がありませんでした。AGY のバージョンと出力への干渉を確認してください。',
    malformedLines: 'AGY の出力に解析できない行が含まれていました。',
    cancelled: '委任はキャンセルされました（AGY プロセスは終了済み。親セッションは続行できます）。',
    textRequired: '委任にはテキストが必要です（AGY ランタイムは画像のみ・構造化入力を受け付けません）。',
    permissionDenied: '[subagent-agy] 権限モード {mode}：AGY は権限が必要な操作（{tools}）を自動的に拒否しました。変更は適用されていません。許可するには permissionMode を yolo にするか、AGY の settings.json に allow ルールを追加してください。',
    permissionToolFallback: '権限が必要なツール',
    detailLabel: '詳細',
  },
  pt: {
    notInstalled: 'O AGY não está instalado ou não está no PATH. Instale a CLI do Antigravity ou defina command com o caminho absoluto do agy.',
    notAuthenticated: 'O AGY precisa de login. Execute agy uma vez no terminal para concluir o login interativo e tente novamente.',
    timeout: 'A delegação expirou e o processo do AGY foi encerrado. Aumente timeoutMs ou reduza o escopo da tarefa.',
    spawnFailed: 'Não foi possível iniciar o processo do AGY. Verifique o caminho em command, o acesso ao cwd e as permissões de execução.',
    protocol: 'Não foi possível interpretar a saída do AGY ou faltou o resultado final. Verifique a versão do AGY e possíveis interferências na saída.',
    malformedLines: 'A saída do AGY continha linhas que não puderam ser interpretadas.',
    cancelled: 'A delegação foi cancelada (processo do AGY encerrado; a sessão principal pode continuar).',
    textRequired: 'Uma delegação precisa conter texto (o runtime do AGY não aceita entrada apenas de imagem ou estruturada).',
    permissionDenied: '[subagent-agy] Modo de permissão {mode}: o AGY negou automaticamente ações que exigem permissão ({tools}); nenhuma alteração foi aplicada. Para permitir, altere permissionMode para yolo ou adicione regras allow no settings.json do AGY.',
    permissionToolFallback: 'ferramentas que exigem permissão',
    detailLabel: 'Detalhe',
  },
  ru: {
    notInstalled: 'AGY не установлен или отсутствует в PATH. Установите Antigravity CLI или укажите в command абсолютный путь к agy.',
    notAuthenticated: 'AGY требует входа. Запустите agy один раз в терминале, чтобы завершить интерактивный вход, и повторите попытку.',
    timeout: 'Делегирование превысило лимит времени, процесс AGY остановлен. Увеличьте timeoutMs или сузьте задачу.',
    spawnFailed: 'Не удалось запустить процесс AGY. Проверьте путь в command, доступ к cwd и права на выполнение.',
    protocol: 'Не удалось разобрать вывод AGY или отсутствует итоговый результат. Проверьте версию AGY и возможные помехи в выводе.',
    malformedLines: 'В выводе AGY были строки, которые не удалось разобрать.',
    cancelled: 'Делегирование отменено (процесс AGY остановлен; родительская сессия может продолжаться).',
    textRequired: 'Делегирование должно содержать текст (среда AGY не принимает только изображения или структурированные данные).',
    permissionDenied: '[subagent-agy] Режим разрешений {mode}: AGY автоматически отклонил действия, требующие разрешения ({tools}); изменения не применены. Чтобы разрешить их, установите permissionMode в yolo или добавьте правила allow в settings.json AGY.',
    permissionToolFallback: 'инструменты, требующие разрешения',
    detailLabel: 'Подробности',
  },
  zh: {
    notInstalled: 'AGY 未安装或不在 PATH 中。请安装 Antigravity CLI，或通过 command 配置指定 agy 的绝对路径。',
    notAuthenticated: 'AGY 需要先登录。请先在终端运行一次 agy 完成交互登录，再重试委派。',
    timeout: '委派超时，AGY 进程已被终止。可调大 timeoutMs 或让任务更聚焦后重试。',
    spawnFailed: '无法启动 AGY 进程。请检查 command 路径、cwd 是否可进入以及执行权限。',
    protocol: 'AGY 输出无法解析或缺少终态结果。请检查 AGY 版本与输出是否被其他程序干扰。',
    malformedLines: 'AGY 输出包含无法解析的行。',
    cancelled: '委派已被取消（AGY 进程已终止，父会话可继续）。',
    textRequired: '委派任务必须包含文本内容（AGY 运行时不接受纯图片/结构化输入）。',
    permissionDenied: '[subagent-agy] 权限档 {mode}：AGY 已自动拒绝需要权限的动作（{tools}），相关修改未执行。若要允许，请把 permissionMode 改为 yolo，或在 AGY 的 settings.json 中配置 allow 规则。',
    permissionToolFallback: '需要权限的工具',
    detailLabel: '详情',
  },
}

const LANGUAGE_ID = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u

/** 把 BCP 47 语言标识截到基础语言；未知返回 undefined。 */
export function normalizeLocale(value: string | undefined): Locale | undefined {
  if (value === undefined) return undefined
  const cleaned = value.trim().split(/[.@]/u)[0]!.replace(/_/gu, '-')
  if (!LANGUAGE_ID.test(cleaned)) return undefined
  const base = cleaned.toLowerCase().split('-')[0]!
  return (LOCALES as readonly string[]).includes(base) ? (base as Locale) : undefined
}

/** 是否为受支持的语言。 */
export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

/** 从 settings.yaml 文本中读取 `locale.preference`。 */
export function settingsLocale(text: string | undefined): Locale | undefined {
  if (text === undefined) return undefined
  let inLocale = false
  for (const raw of text.split(/\r?\n/u)) {
    const line = raw.replace(/#.*$/u, '')
    if (/^locale:\s*$/u.test(line)) { inLocale = true; continue }
    if (/^\S/u.test(line)) inLocale = false
    if (!inLocale) continue
    const match = /^\s+preference:\s*['"]?([^'"\s#]+)/u.exec(line)
    if (match?.[1] !== undefined) {
      const locale = normalizeLocale(match[1])
      if (locale !== undefined) return locale
    }
  }
  return undefined
}

/** 读取 DSH 用户设置文件（$DSH_HOME 或 ~/.dsh）。 */
export function readSettingsText(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const home = env['DSH_HOME'] ?? join(homedir(), '.dsh')
  const file = join(home, 'settings.yaml')
  try {
    return existsSync(file) ? readFileSync(file, 'utf8') : undefined
  } catch {
    return undefined
  }
}

/**
 * 解析界面语言：显式配置优先，其次宿主 locale.preference，再次进程语言环境，最后英文。
 * @param preference - 配置值（`auto` 或语言标识）。
 * @param env - 进程环境。
 * @param settingsText - DSH 设置文件内容。
 */
export function detectLocale(preference: string | undefined, env: NodeJS.ProcessEnv = process.env, settingsText?: string): Locale {
  const explicit = preference !== undefined && preference !== 'auto' ? normalizeLocale(preference) : undefined
  if (explicit !== undefined) return explicit
  const fromSettings = settingsLocale(settingsText)
  if (fromSettings !== undefined) return fromSettings
  return normalizeLocale(env['DSH_LOCALE']) ?? normalizeLocale(env['LC_ALL']) ?? normalizeLocale(env['LANG']) ?? 'en'
}

/** 取文案并替换 `{name}` 占位符。 */
export function t(locale: Locale, key: keyof Messages, vars: Record<string, string> = {}): string {
  return MESSAGES[locale][key].replace(/\{(\w+)\}/gu, (_match, name: string) => vars[name] ?? `{${name}}`)
}
