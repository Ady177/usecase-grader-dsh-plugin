import { Service, type Context } from '@deepseek-ai/cordis';
import { registerRunTool } from '../vendor/runtime-sdk/lib/index.js';
import { gradeAssignment, prepareStandards, generateStandardsFromTopic, type StandardsState } from './workflows.js';

export default class UsecaseGrader extends Service {
  static inject = ['tools', 'sfRuntime'];

  constructor(ctx: Context) {
    super(ctx, 'usecaseGrader');
  }

  private readonly standardsState: StandardsState = { value: [] };

  async *[Service.init]() {
    const unregister: Array<() => Promise<void>> = [];
    yield async () => { await Promise.all(unregister.map((dispose) => dispose())); };
    const service = this;

    unregister.push(registerRunTool<{ topicText: string; teacherDescTemplate?: string }>(this.ctx, {
    toolId: 'sf_usecase_generate_baseline',
    description: '根据软件系统需求生成UML用例模型基准答案，并生成用例描述。',
    inputSchema: {
      type: 'object',
      properties: {
        topicText: { type: 'string', description: '系统题目或原始需求文本' },
        teacherDescTemplate: { type: 'string', description: '可选的教师用例描述模板' },
      },
      required: ['topicText'],
      additionalProperties: false,
    },
    async execute(input, execution) {
      if (!input.topicText.trim()) return { text: '请输入系统题目描述！' };
      try {
        return await generateStandardsFromTopic(execution, input.topicText, service.standardsState, input.teacherDescTemplate ?? '');
      } catch (error) {
        return { text: `基于题目生成基础答案失败：${errorMessage(error)}` };
      }
    },
    }));

    unregister.push(registerRunTool<{ seedAnswer: string; teacherDesc?: string }>(this.ctx, {
    toolId: 'sf_usecase_generate_standards',
    description: '根据教师提供的UML用例模型生成原始、扩大边界和缩小边界三份参考答案及对应描述。',
    inputSchema: {
      type: 'object',
      properties: {
        seedAnswer: { type: 'string', description: '教师标准答案中的参与者和用例' },
        teacherDesc: { type: 'string', description: '教师标准用例描述，作为生成风格模板' },
      },
      required: ['seedAnswer'],
      additionalProperties: false,
    },
    async execute(input, execution) {
      if (!input.seedAnswer.trim()) return { text: '请输入教师标准答案！' };
      try {
        return await prepareStandards(execution, input.seedAnswer, input.teacherDesc ?? '', service.standardsState);
      } catch (error) {
        return { text: `生成失败：${errorMessage(error)}` };
      }
    },
    }));

    unregister.push(registerRunTool<{ assignmentContent: string }>(this.ctx, {
    toolId: 'sf_usecase_grade_assignment',
    description: '使用本插件已生成的标准答案匹配并批改学生UML用例模型作业，返回分数、依据和改进建议。',
    inputSchema: {
      type: 'object',
      properties: {
        assignmentContent: { type: 'string', description: '学生提交的用例图答案和用例描述' },
      },
      required: ['assignmentContent'],
      additionalProperties: false,
    },
    async execute(input, execution) {
      if (service.standardsState.value.length === 0) return { text: '最终得分：0\n\n请先生成标准答案\n\n无' };
      try {
        const result = await gradeAssignment(execution, input.assignmentContent, service.standardsState.value);
        return { text: `最终得分：${result.score}\n\n${result.detail}\n\n${result.summary}` };
      } catch (error) {
        return { text: `最终得分：0\n\n批改异常\n\n${errorMessage(error)}` };
      }
    },
    }));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

declare module '@deepseek-ai/cordis' { interface Context { usecaseGrader: UsecaseGrader } }
