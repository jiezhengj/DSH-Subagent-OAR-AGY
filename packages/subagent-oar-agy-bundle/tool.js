/**
 * 工具行入口：优先挂载官方 OAR 委派工具；官方包不可解析时回退到内置同形工具。
 *
 * FR-014 要求插件在官方 OAR 工具包不可用时明确诊断并回退，且工具表面（名称、参数、
 * 返回结构）保持不变。这里的工具实现改写自官方包
 * `@deepseek-ai/dsh-experimental-tool-subagent-oar`（MIT），只保留 AGY 插件需要的
 * 单运行时委派表面。
 */

import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { getDefaultRunRegistry } from './provider/runs.js'
import { redactSensitive } from './provider/agy/errors.js'

const OFFICIAL_TOOL = '@deepseek-ai/dsh-experimental-tool-subagent-oar'
const DEFAULT_TOOL_NAME = 'subagent_oar_agy'
const DEFAULT_CONTROL_TOOL_NAME = 'subagent_oar_agy_control'

/** 插件名（Cordis 识别用）。 */
export const name = 'subagent-oar-agy-tool'

/** 依赖的工具注册表与子代理服务。 */
export const inject = ['tools', 'subagents']

/** 插件配置：与官方工具相同，另默认使用本插件的工具名。 */
export const Config = Schema.object({
  providers: Schema.dict(Schema.string().min(1)).required(),
  toolName: Schema.string().min(1).default(DEFAULT_TOOL_NAME),
  controlToolName: Schema.string().min(1).default(DEFAULT_CONTROL_TOOL_NAME),
})

/**
 * 解析官方工具包；解析失败返回 `undefined`，由调用方回退。
 * @returns 官方插件模块，或 `undefined`
 */
async function loadOfficialTool() {
  try {
    return await import(OFFICIAL_TOOL)
  } catch {
    return undefined
  }
}

/** 官方与内置实现共用的模型可见工具描述。 */
const TOOL_DESCRIPTION =
  'Delegate a self-contained task to a configured external agent. Choose its runtime for each call. The child works in its own context and does not see this conversation. This tool returns a child id; a later completion notice includes its final answer. The child does not accept follow-up messages. Start independent tasks together and continue useful work while they run. When only waiting for their results remains, end your turn instead of polling.'

/**
 * 构造与官方工具同形的工具定义。
 * @param providers - 运行时别名到提供方名称的映射
 * @param toolName - 模型可见工具名
 * @param ctx - 插件上下文（提供子代理服务）
 * @returns `defineTool` 结果
 */
export function createFallbackTool(providers, toolName, ctx) {
  return defineTool({
    name: toolName,
    description: TOOL_DESCRIPTION,
    parameters: {
      runtime: {
        type: 'string',
        required: true,
        enum: [...providers.keys()],
        description: 'Configured external runtime for this task.',
      },
      description: {
        type: 'string',
        required: true,
        description: 'A short description of the delegated task, for display.',
      },
      prompt: {
        type: 'string',
        required: true,
        description: 'The complete, self-contained task. Include all context the external agent needs.',
      },
      cwd: {
        type: 'string',
        description: 'Initial child working directory. Relative paths use your current directory; omission inherits it.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string', required: true, const: 'activation' },
          subagentId: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `started subagent ${value.subagentId}` }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const parent = exec.agent
      if (parent === undefined) throw new Error(`${toolName} requires a calling agent`)
      const providerName = providers.get(args.runtime)
      const provider = ctx.subagents.getProvider(providerName)
      if (
        provider !== undefined &&
        (provider.prepareContinuable !== undefined || provider.inheritsParentContext)
      ) {
        throw new Error(`${toolName} requires a one-shot provider with independent conversation context`)
      }
      return {
        kind: 'activation',
        subagentId: (
          await ctx.subagents.startActivation({
            provider: providerName,
            label: args.description,
            request: {
              parent,
              prompt: [{ type: 'text', text: args.prompt }],
              ...(args.cwd === undefined ? {} : { cwd: args.cwd }),
            },
            signal: exec.signal,
            delivery: 'parent',
          })
        ).childId,
      }
    },
    presentCall: args => ({ card: 'generic', title: args.description, rawInput: args }),
  })
}


/** 构造控制工具：status 只读快照，cancel 通过官方 interrupt 授权取消。 */
export function createControlTool(ctx, config, registry) {
  return defineTool({
    name: config.controlToolName ?? DEFAULT_CONTROL_TOOL_NAME,
    description:
      'Inspect or cancel an AGY delegation started by this parent session. status returns a bounded snapshot of direct AGY runs; cancel requests asynchronous cancellation. status never starts, resumes, or changes a run.',
    parameters: {
      action: {
        type: 'string',
        required: true,
        enum: ['status', 'cancel'],
        description: 'status: read-only snapshot; cancel: request cancellation of one childId.',
      },
      childId: {
        type: 'string',
        description: 'External child id from subagent_oar_agy. Optional for status (list) and required for cancel.',
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const parent = exec.agent
      const action = args.action
      if (parent === undefined) {
        // 规则 7：取消缺少 exec.agent 时只返回不可用收据；status 仍需调用者身份。
        if (action === 'cancel') {
          return {
            action: 'cancel',
            childId: typeof args.childId === 'string' ? args.childId : '',
            accepted: false,
            reason: 'unavailable',
          }
        }
        throw new Error(`${config.controlToolName ?? DEFAULT_CONTROL_TOOL_NAME} requires a calling agent`)
      }
      const parentId = String(parent.id)
      const activeRegistry = registry ?? getDefaultRunRegistry()
      if (action === 'status') return activeRegistry.status(parentId, args.childId)
      if (typeof args.childId !== 'string' || args.childId.length === 0) {
        throw new Error(`${config.controlToolName ?? DEFAULT_CONTROL_TOOL_NAME}: childId is required for cancel`)
      }
      const receipt = activeRegistry.requestCancel(parentId, args.childId)
      const requestedAt = receipt.requestedAt === undefined
        ? undefined
        : new Date(receipt.requestedAt).toISOString()
      if (receipt.reason === 'not-found' || receipt.reason === 'already-ended') {
        return {
          action: 'cancel',
          childId: args.childId,
          accepted: false,
          reason: receipt.reason,
        }
      }
      try {
        ctx.subagents.interrupt(args.childId, { kind: 'ancestor', agent: parent })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (typeof ctx.logger?.warn === 'function') ctx.logger.warn(`subagent_oar_agy_control cancel failed: ${redactSensitive(message)}`)
        return {
          action: 'cancel',
          childId: args.childId,
          accepted: false,
          reason: 'unavailable',
        }
      }
      return {
        action: 'cancel',
        childId: args.childId,
        // 规则 2：重复请求仍是已受理；首次与重复都返回 accepted:true。
        accepted: receipt.reason === 'accepted' || receipt.reason === 'already-requested',
        reason: receipt.reason,
        ...(requestedAt === undefined ? {} : { requestedAt }),
      }
    },
    presentCall: args => ({ card: 'generic', title: args.action === 'cancel' ? 'cancel AGY delegation' : 'AGY run status', rawInput: args }),
  })
}

/** 注册控制工具，返回精确 disposer。 */
export function registerControlTool(ctx, config, registry) {
  const name = config.controlToolName ?? DEFAULT_CONTROL_TOOL_NAME
  if (name.trim().length === 0) throw new Error('subagent_oar_agy: controlToolName must be non-empty')
  return ctx.tools.register(createControlTool(ctx, config, registry))
}

/**
 * 注册内置回退工具。
 * @param ctx - 插件上下文
 * @param config - 已校验配置
 */
export function registerFallback(ctx, config) {
  const providers = new Map(Object.entries(config.providers))
  if (
    providers.size === 0 ||
    [...providers.keys()].some(runtime => runtime.trim().length === 0)
  ) {
    throw new Error('subagent_oar_agy: providers must contain at least one non-empty runtime alias')
  }
  ctx.tools.register(createFallbackTool(providers, config.toolName ?? DEFAULT_TOOL_NAME, ctx))
}

/**
 * 挂载工具：官方包可用则委托给官方插件，否则回退到内置同形工具。
 * @param ctx - 插件上下文
 * @param config - 已校验配置
 * @param resolveTool - 官方模块解析器，测试可注入
 * @returns `'official'` 或 `'fallback'`
 */
export async function mountTool(ctx, config, resolveTool = loadOfficialTool, registry) {
  const official = await resolveTool()
  const officialConfig = { providers: config.providers, toolName: config.toolName ?? DEFAULT_TOOL_NAME }
  if (official?.apply !== undefined) {
    ctx.plugin(official, officialConfig)
    registerControlTool(ctx, config, registry)
    return 'official'
  }
  const warning = `[subagent_oar_agy] ${OFFICIAL_TOOL} is not resolvable; using the bundled one-shot tool fallback. Install the official package to restore the official implementation.`
  if (typeof ctx.logger?.warn === 'function') ctx.logger.warn(warning)
  else console.warn(warning)
  registerFallback(ctx, config)
  registerControlTool(ctx, config, registry)
  return 'fallback'
}

/**
 * Cordis 插件入口。
 * @param ctx - 插件上下文
 * @param config - 运行时配置
 */
export async function apply(ctx, config) {
  await mountTool(ctx, config)
}
