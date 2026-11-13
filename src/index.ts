import { Service, type Context } from '@deepseek-ai/cordis';
import { registerRunTool } from '../vendor/runtime-sdk/lib/index.js';
import { gradeAssignment, prepareStandards, generateStandardsFromTopic, type StandardAnswer } from './workflows.js';

export default class UsecaseGrader extends Service {
  static inject = ['tools', 'sfRuntime'];

  constructor(ctx: Context) {
    super(ctx, 'usecaseGrader');
  }

  async *[Service.init]() {
    const unregister: Array<() => Promise<void>> = [];
    yield async () => { await Promise.all(unregister.map((dispose) => dispose())); };

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
        return await generateStandardsFromTopic(execution, input.topicText, input.teacherDescTemplate ?? '');
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
        return await prepareStandards(execution, input.seedAnswer, input.teacherDesc ?? '');
      } catch (error) {
        return { text: `生成失败：${errorMessage(error)}` };
      }
    },
    }));

    unregister.push(registerRunTool<{ assignmentContent: string; standards: StandardAnswer[] }>(this.ctx, {
    toolId: 'sf_usecase_grade_assignment',
    description: '对照传入的参考答案匹配并批改学生UML用例模型作业，返回分数、依据和改进建议。',
    inputSchema: {
      type: 'object',
      properties: {
        assignmentContent: { type: 'string', description: '学生提交的用例图答案和用例描述' },
        standards: {
          type: 'array',
          description: '参考答案数组；可使用生成参考答案工具交付的JSON内容',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              diagram: { type: 'string' },
              desc: { type: 'string' },
            },
            required: ['name', 'diagram', 'desc'],
            additionalProperties: false,
          },
        },
      },
      required: ['assignmentContent', 'standards'],
      additionalProperties: false,
    },
    async execute(input, execution) {
      if (input.standards.length === 0) return { text: '最终得分：0\n\n得分明细：请先生成标准答案\n\n总结与改进建议：无' };
      try {
        return await gradeAssignment(execution, input.assignmentContent, input.standards);
      } catch (error) {
        return { text: `最终得分：0\n\n得分明细：批改异常\n\n总结与改进建议：${errorMessage(error)}` };
      }
    },
    }));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

declare module '@deepseek-ai/cordis' { interface Context { usecaseGrader: UsecaseGrader } }
