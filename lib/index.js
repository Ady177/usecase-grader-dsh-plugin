import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Service,              } from '@deepseek-ai/cordis';
import { registerRunTool } from '../vendor/runtime-sdk/lib/index.js';
import { gradeAssignment, prepareStandards, generateStandardsFromTopic, generateUsecaseDescription } from './workflows.js';
import { extractDiagramOnly } from './llm.js';










export default class UsecaseGrader extends Service {
  static inject = ['tools', 'sfRuntime'];
  constructor(ctx         ) { super(ctx, 'usecaseGrader'); }

  async *[Service.init]() {
    const unregister                             = [];
    yield async () => { await Promise.all(unregister.map((dispose) => dispose())); };
    unregister.push(registerRunTool       (this.ctx, {
      toolId: 'sf_usecase_grader',
      description: '生成或准备用例模型参考答案，并匹配、批改学生作业。',
      inputSchema: {
        type: 'object',
        properties: {
          assignmentContent: { type: 'string', description: '学生提交的用例模型作业' },
          topicText: { type: 'string', description: '无教师答案时提供题目需求' },
          teacherAnswer: { type: 'string', description: '可选教师标准答案，含用例图和可选用例描述' },
          teacherDesc: { type: 'string', description: '可选教师用例描述模板' },
          expandToVariants: { type: 'boolean', description: '有教师答案时是否生成扩大、缩小边界变体；默认 false' },
        },
        required: ['assignmentContent'], additionalProperties: false,
      },
      async execute(input, execution) {
        const root = execution.outputDirectory;
        const standards                   = [];
        const save = async (relative        , value         , kind                           = 'intermediate') => {
          execution.signal.throwIfAborted();
          const path = join(root, relative);
          await mkdir(join(path, '..'), { recursive: true });
          await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
          await execution.addArtifact({ kind, name: relative.split('/').at(-1) , relativePath: relative, mime: 'application/json' });
        };
        await execution.reportProgress({ stage: 'prepare', stageName: '准备标准答案', progress: 5 });
        await save('input/algorithm-request.json', input);
        if (input.teacherAnswer?.trim()) {
          await execution.reportProgress({ stage: 'teacher-answer', stageName: '读取教师答案', progress: 10 });
          const descMarker = input.teacherAnswer.indexOf('用例描述');
          const embeddedDesc = descMarker >= 0 ? input.teacherAnswer.slice(descMarker + '用例描述'.length).trim() : '';
          const teacherDesc = input.teacherDesc?.trim() ? input.teacherDesc : embeddedDesc;
          if (input.expandToVariants) {
            const prepared = await prepareStandards(execution, input.teacherAnswer, teacherDesc, { value: standards });
            await save('intermediate/standards-preview.json', prepared);
          } else {
            const diagram = extractDiagramOnly(input.teacherAnswer);
            const desc = descMarker >= 0
              ? embeddedDesc
              : await (async () => {
                await execution.reportProgress({ stage: 'description', stageName: '生成教师答案用例描述', progress: 70 });
                return generateUsecaseDescription(execution, diagram, teacherDesc);
              })();
            standards.push({ name: '原始答案（基准）', diagram, desc });
          }
        } else if (input.topicText?.trim()) {
          const state = { value: standards };
          const baseline = await generateStandardsFromTopic(execution, input.topicText, state, input.teacherDesc ?? '');
          await save('intermediate/baseline-preview.json', baseline);
        } else {
          throw new Error('请提供题目需求或教师标准答案');
        }
        await save('intermediate/standards.json', standards);
        await execution.reportProgress({ stage: 'grading', stageName: '开始匹配与批改', progress: 80 });
        const graded = await gradeAssignment(execution, input.assignmentContent, standards);
        const report = `最终得分：${graded.score}\n\n${graded.detail}\n\n${graded.summary}`;
        const resultPath = join(root, 'final', 'grading-result.txt');
        await mkdir(join(root, 'final'), { recursive: true });
        await writeFile(resultPath, report, 'utf8');
        const artifact = await execution.addArtifact({ kind: 'final', name: 'grading-result.txt', relativePath: 'final/grading-result.txt', mime: 'text/plain; charset=utf-8' });
        const resultJson = { score: graded.score, detail: graded.detail, summary: graded.summary, standards };
        const jsonPath = join(root, 'final', 'grading-result.json');
        await writeFile(jsonPath, `${JSON.stringify(resultJson, null, 2)}\n`, 'utf8');
        const jsonArtifact = await execution.addArtifact({ kind: 'final', name: 'grading-result.json', relativePath: 'final/grading-result.json', mime: 'application/json' });
        await execution.reportProgress({ stage: 'complete', stageName: '批改完成', progress: 100 });
        return { text: report, files: [artifact.artifactId, jsonArtifact.artifactId] };
      },
    }));
  }
}


