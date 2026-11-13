import type { Context } from '@deepseek-ai/cordis';
import { type ToolDefinition, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { Artifact, ArtifactInput, BusinessResult, ModelRef, ModelRequest, ModelResponse, ModelConnection, ModelProtocol, ProgressReport, IssueReport, ReportStatus, RunObject, InteractionRequest, InteractionAnswer } from './contracts/runtime.js';
export type * from './contracts/runtime.js';
export interface RunInteraction {
    ask<T extends InteractionRequest['type']>(request: Extract<InteractionRequest, {
        type: T;
    }>): Promise<Extract<InteractionAnswer, {
        type: T;
    }>>;
}
export interface ExecutionContext {
    readonly runId: string;
    readonly outputDirectory: string;
    readonly signal: AbortSignal;
    readonly interaction: RunInteraction;
    reportStatus(status: ReportStatus, message?: string): Promise<void>;
    reportProgress(report: ProgressReport): Promise<void>;
    log(message: string, stage?: string): Promise<void>;
    reportIssue(issue: IssueReport): Promise<void>;
    addArtifact(file: ArtifactInput): Promise<Artifact>;
    registerCleanup(callback: () => void | Promise<void>): void;
    readonly model: {
        readonly selection?: ModelRef;
        /** Stateless API-style request with optional per-call temperature, maxTokens and stop. */
        call(request: ModelRequest): Promise<ModelResponse>;
        /** Host-only task credentials. Never include this value in logs or Tool results. */
        getConnection(request: {
            protocol: ModelProtocol;
        }): Promise<ModelConnection>;
    };
}
export interface RunToolDefinition<I = RunObject> {
    toolId: string;
    description: string;
    inputSchema: RunObject;
    /** Optional for native HTTP SDK users; legacy model.call tools omit it. */
    modelProtocols?: ModelProtocol[];
    execute(input: Readonly<I>, execution: ExecutionContext): Promise<BusinessResult>;
}
/** Host-only protocol seam. Access requires a real Tool execution minted by DSH. */
export interface RunProtocolHost {
    registerEntry(tool: ToolDefinition, options?: {
        modelProtocols?: ModelProtocol[];
    }): () => void;
    executionFor(exec: ToolRunContext, tool: ToolDefinition): ExecutionContext;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        sfRuntime: RunProtocolHost;
    }
}
/** Register once on plugin enable. DSH still owns policy, guards and dispatch. */
export declare function registerRunTool<I = RunObject>(ctx: Context, definition: RunToolDefinition<I>): () => Promise<void>;
