
import { callLlm, extractDiagramOnly, parseJsonResponse } from './llm.js';































async function generateUsecaseDescription(execution                  , answerText        , teacherDesc = '') {
  const systemPrompt = teacherDesc.trim()
    ? `
你是一位软件工程领域专家。

现在有一份标准用例描述模板：
${teacherDesc}

请保持：
1. 字段格式一致
2. 编号风格一致
3. 语言风格一致
4. 粒度一致
5. 软件工程教材规范

根据新的用例模型答案，生成**带完整业务场景**的用例描述。
必须包含：触发场景、主流程闭环、异常场景、结束状态。
只生成1份核心用例。
禁止解释说明。
`
    : `
你是软件工程专家，负责编写标准UML用例描述。
必须遵循：业务场景驱动 + 完整闭环 + 异常覆盖。

格式：

用例名称：XXX
适用场景：XXX（明确业务场景）
主要参与者：XXX
前置条件：XXX
后置条件：XXX

基本流程（场景主流程）：
1. XXX
2. XXX
3. XXX

扩展流程（异常场景）：
3a. XXX
3b. XXX
`;
  return callLlm(execution, systemPrompt, `根据以下用例模型生成标准用例描述：\n${answerText}`, 0.1);
}

function pythonJson(value         )         {
  const json = JSON.stringify(value);
  let result = '';
  let inString = false;
  let escaped = false;
  for (const char of json) {
    if (inString) {
      result += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
      result += char;
    } else if (char === ',') result += ', ';
    else if (char === ':') result += ': ';
    else result += char;
  }
  return result;
}

export async function generateStandardsFromTopic(execution                  , topicText        , state                , teacherDescTemplate = '') {
  const initPrompt = `你是一位专业的系统分析师。请根据用户的题目/原始需求文本，提炼初始的UML用例模型及涉及的核心数据实体。
请严格按以下 JSON 格式输出：
{
  "actors": ["参与者1", "参与者2"],
  "use_cases": ["用例1", "用例2"],
  "entities": ["数据实体1", "数据实体2"]
}
`;
  let modelData = parseJsonResponse              (await callLlm(execution, initPrompt, `系统原始题目：\n${topicText}`, 0.2));

  for (let iteration = 0; iteration < 2; iteration += 1) {
    execution.signal.throwIfAborted();
    const detectorPrompt = `你是一位严谨的软件工程专家。请为当前的用例和实体列表进行CRUD完整性检测。
【检测规则】：
1. 区分系统内部实体和外部实体。内部实体必须具备完整的 C(创建)、R(读取)、U(更新)、D(删除) 操作。
2. 若某内部实体在当前用例中缺失了某项必要的操作（例如只有创建订单没有取消/修改订单），则将其列为需求缺失项（Gap）。

请直接返回以下 JSON 格式：
{
  "missing_gaps": [
     {"entity": "实体名", "missing_operation": "C/R/U/D中的缺失项", "reason": "缺失说明"}
  ]
}
`;
    const detected = parseJsonResponse                                                                                         (
      await callLlm(execution, detectorPrompt, `当前用例: ${pythonJson(modelData.use_cases)}\n当前实体: ${pythonJson(modelData.entities)}`, 0.1),
    );
    const gaps = Object.hasOwn(detected, 'missing_gaps') ? detected.missing_gaps : [];
    if (!gaps || (typeof gaps.length === 'number' && gaps.length === 0)) break;
    const completerPrompt = `你是一位需求工程专家。请针对需求检测报告中的缺失项（Gaps），为该系统补充缺失的合理用例。
同时注意【抗幻觉检查】：不要脱离主业务引入无关联的孤立用例和实体。

当前模型：${pythonJson(modelData)}
缺失报告：${pythonJson(gaps)}

请补充后输出完整的最新模型 JSON：
{
  "actors": ["参与者列表"],
  "use_cases": ["用例列表"],
  "entities": ["实体列表"]
}
`;
    modelData = parseJsonResponse              (await callLlm(execution, completerPrompt, '请补全并返回最新JSON', 0.2));
  }

  const diagram = `参与者：${modelData.actors.join(', ')}\n用例：${modelData.use_cases.join(', ')}`;
  const desc = await generateUsecaseDescription(execution, diagram, teacherDescTemplate);
  state.value = [{ name: '原始答案', diagram, desc }];
  let preview = '### 基础参考答案已生成\n';
  preview += `#### 原始答案（基准）\n##### 用例图答案\n${diagram}\n\n##### 用例描述\n${desc}\n\n`;
  return { text: preview };
}

async function reviewGeneratedAnswer(execution                  , seedDiagram        , variantAnswer        , mode        ) {
const systemPrompt = `
你是一位资深软件架构师与UML建模专家。

当前答案类型：${mode}

请审核该答案是否符合真实软件工程场景。

审核标准：
1. 每个用例必须是用户目标，而不是内部实现动作
2. 每个参与者(actor)必须位于系统边界外
3. 判断参与者是否真实合理：
    3.1：一个系统若是现有系统，一般可以被单独列出为外部参与者。
    3.2：一个系统若功能复杂，可以实现多个功能，可以被单独列出作为外部参与者。

以下类型通常不应独立成为参与者（除非题目明确说明）：
- 搜索系统
- 排序系统
- 定价引擎
- 座位图服务
- 折扣模块
- 推荐模块
这些通常属于系统内部模块。

4. 扩大边界要求：
- actor减少
- 系统吸收简单模块职责
- 支付系统等复杂现有系统通常保留为外部actor

5. 缩小边界要求：
- actor增加
- 仅将现实中可能独立存在的复杂系统拆出
- 不允许把简单模块强行拆成actor

而对于用例
1.需要根据参与者进行调整和修改
2.用例需要是一个具有一定流程的业务用例。不能是一个简单的功能描述，但也不能太过概括。例如选座位仅有一步难以成为用例，预定机票可以作为用例

输出JSON如下：
{
 "revised_answer":"修正后的答案",
 "reason":"修正原因"
}
`;
  const raw = await callLlm(execution, systemPrompt, `原始标准答案：\n${seedDiagram}\n\n生成答案：\n${variantAnswer}`, 0.1);
  try {
    const revisedAnswer = parseJsonResponse                             (raw).revised_answer;
    return revisedAnswer === undefined ? variantAnswer : revisedAnswer;
  } catch {
    return variantAnswer;
  }
}

export async function prepareStandards(execution                  , seedAnswer        , teacherDesc        , state                ) {
  const seedDiagram = extractDiagramOnly(seedAnswer);
  const reasoning = await callLlm(execution, `
你是一位UML专家。

请基于原答案生成两个系统边界变化的变体。

变体1（扩大边界）要求：

1. 系统吸收部分简单外部职责
2. actor数量减少
3. 复杂成熟系统通常保留外部actor
4. 用例重新调整

变体2（缩小边界）要求：

1. 系统职责减少
2. 仅将现实中可能独立存在的复杂系统作为actor
3. 系统可以有新参与者实现新增的功能
4. actor数量增加
5. 用例重新调整

请一步一步完成
`, seedDiagram, 0.5);
  const raw = await callLlm(execution, `
根据推理结果输出两个答案变体。

返回JSON：

{
  "variants":[
    "答案1",
    "答案2"
  ]
}
`, `原答案：\n${seedDiagram}\n\n推理结果：\n${reasoning}`, 0.2);
  const parsedVariants = parseJsonResponse                         (raw);
  const variantsValue = Object.hasOwn(parsedVariants, 'variants') ? parsedVariants.variants : [];
  if (!Array.isArray(variantsValue)) throw new TypeError('variants must be a list');
  const variants = variantsValue;
  while (variants.length < 2) variants.push(seedDiagram);
  variants[0] = await reviewGeneratedAnswer(execution, seedDiagram, variants[0], '扩大边界');
  variants[1] = await reviewGeneratedAnswer(execution, seedDiagram, variants[1], '缩小边界');
  const names = ['原始答案（基准）', '变体1（扩大边界）', '变体2（缩小边界）'];
  const diagrams = [seedDiagram, ...variants.slice(0, 2)];
  state.value = [];
  for (let i = 0; i < 3; i += 1) {
    const desc = await generateUsecaseDescription(execution, diagrams[i], teacherDesc);
    state.value.push({ name: names[i], diagram: diagrams[i], desc });
  }
  const preview = state.value.map((item) => `#### ${item.name}\n##### 用例图答案\n${item.diagram}\n\n##### 用例描述\n${item.desc}`).join('\n\n---\n');
  return { text: `### 标准答案库已生成（结构化存储）\n\n${preview}\n\n---\n` };
}

function pythonInt(value         )         {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string' && /^[+-]?\d+$/.test(value.trim())) return Number(value.trim());
  throw new TypeError('best_index must be an integer');
}

function pythonString(value         )         {
  if (value === null || value === undefined) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  return String(value);
}

export async function gradeAssignment(execution                  , assignmentContent        , standards                  ) {
  // The original matcher compares only the diagram text; keep descriptions out of this prompt.
  const standardBlock = standards.map((item, i) => `\n【参考答案${i}】\n${item.diagram}\n`).join('');
  let best = standards[0];
  let matchName = best.name;
  let matchReason = '默认匹配基准答案';
  try {
    const data = parseJsonResponse                                          (await callLlm(execution,
      `
你是UML评审专家。

请通过对比参与者设置，选择最符合要求的参考答案。

返回JSON：

{
 "best_index":0,
 "reason":"原因"
}
`,
      `学生作业：\n${assignmentContent}\n\n${standardBlock}`, 0));
    const idx = pythonInt(Object.hasOwn(data, 'best_index') ? data.best_index : 0);
    best = standards[idx >= 0 && idx < standards.length ? idx : 0];
    matchName = best.name;
    matchReason = Object.hasOwn(data, 'reason') ? pythonString(data.reason) : '无说明';
  } catch {
    // Preserve the original fallback to the first reference answer.
  }
const systemPrompt = `
你是一位严谨的软件工程评分系统。请采用【加分制】对学生作业进行客观评分。
从 0 分开始，根据学生作业对知识点的准确覆盖情况进行加分，上限 100 分。

【加分项清单】：
1. 用例图 (Max 40分):
   - 核心参与者识别：覆盖核心参与者（用户）则加15分，若存在支付行为但是缺少支付系统，则此项扣5分，若非人参与者未使用《actor》则扣5分。
   - 绘图规范：系统边界矩形及命名(+5分)，UML关联关系线正确(+5分)。若存在《extend》和《include》关系，此项扣除5分。
   - 用例识别：不能只按名称判断是否命中。必须将学生用例与标准答案展开为任务单元后比较。
        例如：
        预订航班 = 查询航班+选择航班+填写乘客信息+提交订单+支付+生成订单
        管理订单 = 查询订单+修改订单+取消订单
    对于标准答案的每个用例，若学生的用例或展开后的任务单元，与标准答案展开为任务单元后整体含义类似，则视为命中，不需要完全匹配，大体覆盖即可。
    全部用例命中，此项得15分，否则少一项扣除3分。

2. 用例描述 (Max 60分):
   以下规则严格遵循【业务场景驱动 + 闭环业务流程】
   - 场景完整性：描述必须是完整业务场景，不是零散动作 (+15分)，些许缺失（+12分），完全缺失（+0分）
   - 业务闭环：基本流程从触发到结束形成完整闭环，无断裂 (+15分)，若存在些许未闭环（+12分），完全不闭环（+0分）
   - 异常场景：若扩展流程覆盖真实业务异常（合理即可）(+10分)，若存在些许未覆盖（+8分），完全不覆盖（+0分）
   - 一致性：若描述与用例图参与者、用例完全一致 (+10分)，存在略微不同（+7分），完全不同（+0分）（用例描述一个即可）
   - 格式规范：结构清晰、步骤编号合理 (+10分)，若存在中英文夹杂，此项扣除5分。

【评分依据】
1. 必须形成业务闭环（触发→执行→结束）
2. 必须覆盖正常场景 + 异常场景
3. 必须与用例图保持业务逻辑一致性
请逐步完成打分

【参考标准答案】：


${best.diagram}




请严格按以下 JSON 格式输出：
{
    "total_score": 最终累计得分（<100整数）, 
    "target_usecase": "描述的目标用例名称",
    "detailed_feedback": [
        {"reason": "得分依据",
          "item": "得分项", 
         "score_added": 获得分值, 
         }
    ],
    "improvement_suggestions": "缺失知识点的补正建议（不需要输出分数）",
    "overall_summary": "简短的批改总结（不需要输出分数）"
}`;
  const parsed = parseJsonResponse             (await callLlm(execution, systemPrompt, `学生作业：\n${assignmentContent}`, 0));
  const feedback = Object.hasOwn(parsed, 'detailed_feedback') ? parsed.detailed_feedback : [];
  if (!Array.isArray(feedback)) throw new TypeError('detailed_feedback must be a list');
  parsed.total_score = feedback.reduce((sum, item) => {
    const score = Object.hasOwn(item, 'score_added') ? item.score_added : 0;
    if (typeof score !== 'number' && typeof score !== 'boolean') throw new TypeError('unsupported operand type for score_added');
    return sum + Number(score);
  }, 0);
  const detail = feedback.map((item, i) => `${i + 1}.【${pythonString(item.item)}】 +${pythonString(item.score_added)}分\n依据：${pythonString(item.reason)}`).join('\n\n');
  return {
    score: parsed.total_score,
    detail: `匹配标准答案：${matchName}\n匹配原因：${matchReason}\n\n得分明细：\n\n${detail}${detail ? '\n\n' : ''}`,
    summary: `批改总结：${pythonString(parsed.overall_summary)}\n\n改进建议：${pythonString(parsed.improvement_suggestions)}`,
  };
}
