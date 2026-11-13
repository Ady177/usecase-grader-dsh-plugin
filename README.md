# UML 用例模型智能批改 DSH 插件

把原 Python/Gradio「用例模型打分」项目接入软件工厂 Run。业务算法以 TypeScript 实现，通过 Runtime SDK 登记 DSH Tool，并使用 `execution.model.call()` 调用任务选定的模型。插件不保存或接收模型 API Key。

## 功能

1. **生成基准答案**：从题目提取参与者、用例和实体；最多执行两轮 CRUD 缺口检查与补全；生成一份用例描述。
2. **生成参考答案**：从教师答案生成原始、扩大边界、缩小边界三份答案；审核两个变体并生成相应描述。
3. **批改作业**：先按用例图匹配参考答案，再按原评分规则生成得分明细、总结和改进建议。

评分维度：用例图 40 分（参与者 15、绘图规范 10、用例识别 15）；用例描述 60 分（场景完整性 15、业务闭环 15、异常场景 10、一致性 10、格式规范 10）。总分由反馈项目的 `score_added` 累加。

## Tools 与输入

| toolId | 必填输入 | 可选输入 | 结果 |
| --- | --- | --- | --- |
| `sf_usecase_generate_baseline` | `topicText`：题目/需求文本 | `teacherDescTemplate`：用例描述模板 | 答案文本和 `baseline-standard.json` |
| `sf_usecase_generate_standards` | `seedAnswer`：教师参与者与用例 | `teacherDesc`：教师用例描述模板，可留空并使用默认格式 | 三种答案和 `standard-answers.json` |
| `sf_usecase_grade_assignment` | `assignmentContent`：学生作业；`standards`：标准答案数组 | 无 | 分数、明细、总结和建议（文本结果） |

`standards` 数组中的每项结构为：

```json
{
  "name": "原始答案（基准）",
  "diagram": "参与者：读者、图书管理员\n用例：查询图书、借阅图书",
  "desc": "用例名称：借阅图书……"
}
```

生成参考答案 Tool 的 `standard-answers.json` 是上述数组。批改任务要把该数组内容作为 `standards` 输入；这替代原 Python 程序只在单次进程内有效的 `GLOBAL_STANDARDS`，不依赖跨任务共享内存。

## 运行环境与构建

当前目标基线依据已提供的组内材料：Node.js 24+、DSH `0.2.1-alpha.2`、Runtime 0.4.0、Runtime SDK 0.4.1。Runtime README 说明 DSH 0.2.2 尚未适配，请勿据此宣称兼容 DSH 0.2.2。

源码按组内 `software-factory-x-req-split` 的 Cordis Service 工程结构组织。插件包携带 Runtime SDK；构建脚本使用 Node.js 内置 TypeScript 类型剥离，把 `src/*.ts` 转成 `lib/*.js`，不需要另外安装 TypeScript/tsdown 或指定 DSH 源码路径。构建需要 Node.js 24.12+（该版内置类型剥离已稳定），在插件目录执行：

```powershell
node scripts/build.mjs
```

本项目没有单独的 TypeScript 类型检查脚本；构建脚本使用 Node 内置类型剥离，只生成 JavaScript，不检查类型。运行时继续使用 DSH 宿主提供的 Cordis 和 DSH Tools 模块。**构建后仍需在兼容的 DSH 宿主安装验证。**

## 安装与调用

在兼容 DSH 中先启用 Runtime，再安装并启用本业务插件；从已选择真实工作区的会话调用对应 Tool。模型沿用 DSH/Runtime 任务所选配置，业务输入不包含 API Key。配套 WebUI 负责显示执行卡片；算法与 Tool 不依赖本项目提供独立网页。

生成基准答案调用示例：

```json
{
  "topicText": "设计一个图书管理系统，读者可以查询、借阅和归还图书；管理员可以上架图书。"
}
```

批改调用示例：

```json
{
  "assignmentContent": "参与者：读者、图书管理员\n用例：查询图书、借阅图书……",
  "standards": [
    { "name": "原始答案（基准）", "diagram": "参与者：……\n用例：……", "desc": "用例名称：……" }
  ]
}
```

`execution` 会向 Runtime 上报阶段进度和日志，并在模型调用前后检查取消信号。基准答案和三份标准答案以 JSON 文件交付，供后续批改任务传入；评分结果按原程序以文本返回，不额外生成结果文件。输入和产物由 Runtime 保存在任务工作区。

## 源码位置

- `src/index.ts`：Cordis Service 与三个 Run Tool 注册。
- `src/workflows.ts`：业务提示词、答案生成、匹配和评分流程。
- `src/llm.ts`：Runtime SDK 模型调用与原有 JSON/文本解析逻辑。
- `cordis.patch.yml`：DSH Bundle 插件挂载配置。
- `scripts/build.mjs`：使用 Node 内置 TypeScript 类型剥离生成 DSH 加载的 JavaScript 文件。

## 交付状态

插件源码和安装包已构建，TypeScript 严格类型检查、三条业务流程的假模型验证以及 DSH `0.2.1-alpha.2` + Runtime `0.4.0` 的本机加载验证已完成。真实模型端到端调用尚未验证；插件尚未发布到 GitHub。
