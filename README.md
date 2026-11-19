# UML 用例模型智能批改 DSH 插件

将原 Python/Gradio「用例模型打分」流程接入软件工厂。插件注册一个 DSH Run Tool，在单个任务内准备标准答案、匹配并批改；业务模型调用使用 Runtime SDK `execution.model.call()`。

## 单工具流程

Tool ID：`sf_usecase_grader`

1. 提交学生作业，并在题目需求或教师答案中提供一个作为参考答案来源。
2. 未提供教师答案时，根据题目生成基础标准答案（原 CRUD 检查最多两轮）。
3. 提供教师答案时，`expandToVariants: false` 使用教师答案作为单份标准答案；为 `true` 时按原流程生成、审核扩大和缩小边界变体，共三份标准答案。
4. 匹配参考答案，按原评分规则评分并交付报告。

Tool 输入：

| 字段 | 必填 | 说明 |
|---|---|---|
| `assignmentContent` | 是 | 学生作业内容 |
| `topicText` | 否 | 无教师答案时用来生成基础标准答案；需与 `teacherAnswer` 至少提供一项 |
| `teacherAnswer` | 否 | 教师答案中的参与者、用例和可选的“用例描述”段 |
| `teacherDesc` | 否 | 描述模板；教师答案未包含描述时用于生成描述 |
| `expandToVariants` | 否 | 有教师答案时是否扩展为原始、扩大、缩小三份答案；默认 `false` |

`teacherAnswer` 优先于 `topicText`。三种原流程的业务提示词、温度、两轮 CRUD 上限、变体审核、参考答案匹配回退、评分项目及 `score_added` 求和方式保留。原 Gradio 的分数、明细和总结在 Run Tool 中合并为文本，同时提供结构化 JSON。

## 任务目录、产物与下载

所有业务数据写入 Runtime 提供的 `execution.outputDirectory`，标准答案在每次执行中重新构造，不保存在插件 Service 共享数组或跨任务公共文件中。Runtime 自动将输入保存为 `input/request.json`；插件不重复复制或登记输入。插件写入的典型产物如下：

```text
intermediate/model-calls/                 # 每次模型调用的请求、响应/错误
intermediate/initial-model.json            # 题目生成路径
snapshots/                                  # CRUD 检查与逐份标准答案快照
intermediate/standards.json                 # 当前任务的标准答案库
intermediate/matched-standard.json         # 匹配结果
intermediate/grading-result.json            # 评分原始结构化结果
final/grading-result.txt                    # 人类可读报告
final/grading-result.json                   # 结构化报告与标准答案
```

插件写入的中间产物和最终产物通过 `execution.addArtifact()` 登记。Runtime 自动管理的 `input/request.json` 不由插件再次登记。最终两个文件的 `artifactId` 从 Run Tool 的 `files` 返回；Runtime 为下载提供认证引用。成功、失败、取消时，已写入的有效中间材料留在当前 Run 下。Runtime 的取消信号传入模型调用前后及文件保存检查；未捕获的异常向 Runtime 抛出，由 Runtime 标记失败。

## Agent 登记资料

包内 `agent-registration.json` 是本插件的结构化 Agent 登记资料，包含能力、调用入口、真实参数、产物、环境约束及模拟验证证据；Tool ID 与 `dsh_ref` 一致。登记资料不由插件直接写数据库，需由平台 Manage/维护者审核录入。`agent_id`、版本顶点 ID 和启用状态由平台在登记流程中确定；开发人员填写为仓库所有者账号 `Ady177`。真实性能、成本和效果尚无实测证据，因此没有编造数值；`performance_evidence_json` 明确标为流程模拟。

字段取舍和入库注意事项见包内 `agent-registration-notes.md`。模型由 Run 发起方选择并经 Runtime 传入，因此不声明固定厂商/模型依赖或模型优选策略。

## 运行与构建

目标依据已提供组内材料：Node.js 24+、DSH `0.2.1-alpha.2`、Runtime 0.4.0、Runtime SDK 0.4.1。插件包携带 SDK，运行时依赖 DSH 宿主的 Cordis 和 DSH Tools，并需先启用 Runtime。

```powershell
node scripts/build.mjs
```

构建使用 Node.js 内置 TypeScript 类型剥离；另行类型检查使用组内对应版本类型。模型/API 凭据由宿主提供，插件不读取或保存 API Key。

## 验证范围

构建、静态类型检查及假模型 Run 验证可检查参数分支、产物登记、进度和取消/错误传递。真实模型调用及目标 DSH 宿主上的新版单工具加载仍需在有凭据的宿主环境验收；README 不将模拟调用称为真实模型效果证据。
