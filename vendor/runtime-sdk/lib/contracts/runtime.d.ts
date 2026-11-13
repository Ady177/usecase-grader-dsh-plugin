/** Run API 1.0. JSON-only types shared by the backend, SDK and future UI. */
export type RunJson = null | boolean | number | string | RunJson[] | {
    [key: string]: RunJson;
};
export type RunObject = {
    [key: string]: RunJson;
};
export type RunStatus = 'queued' | 'running' | 'cancelling' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
export type ReportStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export interface ModelRef {
    provider: string;
    model: string;
    reasoningEffort?: string;
}
export interface RunRequest {
    toolId: string;
    input: RunObject;
    model?: ModelRef;
    timeoutMs?: number;
}
export interface InteractionOption {
    value: string;
    label: string;
    description?: string;
}
export interface InteractionBase {
    question: string;
    detail?: string;
    timeoutMs?: number;
}
export type InteractionRequest = InteractionBase & ({
    type: 'select';
    options: InteractionOption[];
} | {
    type: 'text';
    placeholder?: string;
} | {
    type: 'mixed';
    options: InteractionOption[];
    placeholder?: string;
});
export type InteractionAnswerInput = {
    type: 'select';
    value: string;
} | {
    type: 'text';
    text: string;
} | {
    type: 'mixed';
    value?: string;
    text?: string;
};
export type InteractionAnswer = InteractionAnswerInput & {
    interactionId: string;
};
export interface InteractionRecord {
    interactionId: string;
    request: InteractionRequest;
    status: 'pending' | 'answered' | 'cancelled' | 'expired';
    stage?: string;
    createdAt: string;
    expiresAt: string;
    finishedAt?: string;
    answer?: InteractionAnswer;
}
export interface AnswerInteractionRequest {
    runId: string;
    interactionId: string;
    answer: InteractionAnswerInput;
}
export interface InteractionAccepted {
    interactionId: string;
    status: 'answered';
}
export type ModelProtocol = 'openai-completions' | 'openai-responses' | 'anthropic-messages';
export interface ModelConnection {
    baseUrl: string;
    apiKey: string;
    model: string;
    protocol: ModelProtocol;
}
export interface ToolContract {
    toolId: string;
    description: string;
    inputSchema: RunObject;
    supportsRun: boolean;
    modelProtocols?: ModelProtocol[];
}
export interface ProgressReport {
    stage: string;
    stageName: string;
    progress?: number;
    message?: string;
}
export interface IssueReport {
    level: 'warning' | 'error';
    stage?: string;
    code?: string;
    message: string;
    fatal?: boolean;
}
export interface LogRecord {
    message: string;
    stage?: string;
    time: string;
}
export interface IssueRecord extends IssueReport {
    time: string;
}
export interface ArtifactInput {
    kind: 'intermediate' | 'final';
    name: string;
    relativePath: string;
    mime: string;
}
export interface Artifact extends ArtifactInput {
    artifactId: string;
    size: number;
    downloadUrl?: string;
}
/** Host directory containing registered intermediate files, resolved by Runtime. */
export interface ArtifactDirectory {
    path: string;
    fileCount: number;
}
export interface BusinessResult {
    text?: string;
    files?: string[];
}
export interface RunResult {
    text?: string;
    files: Artifact[];
}
/** API-style image input; URLs are public HTTP(S) or base64 image data URLs. */
export interface ModelTextPart {
    type: 'text';
    text: string;
}
export interface ModelImagePart {
    type: 'image_url';
    image_url: {
        url: string;
    };
}
export type ModelUserContent = string | Array<ModelTextPart | ModelImagePart>;
export type ModelMessage = {
    role: 'system' | 'assistant';
    content: string;
} | {
    role: 'user';
    content: ModelUserContent;
};
export interface ModelRequest {
    messages: ModelMessage[];
    /** Optional per-call controls; omission preserves the DSH route defaults. */
    temperature?: number;
    maxTokens?: number;
    stop?: string[];
}
/** DSH usage: inputTokens excludes cache; preserve the optional cache counters. */
export interface ModelUsage {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
}
export interface ModelResponse {
    text: string;
    usage?: ModelUsage;
}
export interface ModelCallSummary {
    requestId: string;
    protocol: ModelProtocol | 'sdk';
    stage?: string;
    model: ModelRef;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    startedAt: string;
    finishedAt?: string;
    durationMs?: number;
    usage?: RunJson;
    error?: {
        code: string;
        message: string;
    };
}
export interface ModelCallRecord extends ModelCallSummary {
    request: RunJson;
    response?: RunJson;
    transcript?: RunJson;
}
export interface ModelCallRequest extends RunIdRequest {
    requestId: string;
}
export interface RunSummary {
    runId: string;
    toolId: string;
    status: RunStatus;
    stage?: string;
    stageName?: string;
    progress?: number;
    message?: string;
    createdAt: string;
    startedAt?: string;
    finishedAt?: string;
}
export interface RunRecord extends RunSummary {
    apiVersion: '1.0';
    model?: ModelRef;
    logs: LogRecord[];
    issues: IssueRecord[];
    artifacts: Artifact[];
    intermediateDirectories?: ArtifactDirectory[];
    result?: RunResult;
    lastSeq: number;
    modelCalls?: ModelCallSummary[];
    sourceSessionId?: string;
    executionSessionId?: string;
    interactions?: InteractionRecord[];
    pendingInteraction?: InteractionRecord;
}
export interface ListRunsRequest {
    toolId?: string;
    status?: RunStatus;
    limit?: number;
    offset?: number;
}
export interface RunIdRequest {
    runId: string;
}
export interface ArtifactRequest extends RunIdRequest {
    artifactId: string;
}
export interface ToolContractRequest {
    toolId: string;
    model?: ModelRef;
}
export interface WaitRunRequest extends RunIdRequest {
    afterSeq?: number;
    waitMs?: number;
}
export interface WatchRunRequest extends RunIdRequest {
    afterSeq?: number;
}
export interface RunEvent {
    runId: string;
    seq: number;
    type: 'status' | 'progress' | 'log' | 'issue' | 'artifact' | 'result' | 'interaction';
    data: RunJson;
    time: string;
}
export interface RunAccepted {
    runId: string;
    status: 'queued';
}
export interface RunList {
    items: RunSummary[];
    total: number;
}
export interface RunUpdate {
    run: RunSummary;
    events: RunEvent[];
    lastSeq: number;
}
export interface CancelResult {
    runId: string;
    status: RunStatus;
}
export interface RuntimeFailure {
    code: string;
    message: string;
}
export type RuntimeResult<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: RuntimeFailure;
};
