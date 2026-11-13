# UML 用例模型智能批改 DSH 插件

将原 Python/Gradio「用例模型打分」程序的处理流程接入软件工厂 Run。业务流程以 TypeScript 实现，通过 Runtime SDK 注册 DSH Run Tool，并使用当前任务选定的模型。

## 功能

插件保留原程序的三个操作：

1. **生成基础答案**：从题目抽取参与者、用例和实体，最多执行两轮 CRUD 缺口检测与补全，生成一份用例描述，并将该答案写入标准答案库。
2. **生成标准答案库**：从教师标准答案中提取用例图，生成扩大边界和缩小边界两个变体，审核变体，为原答案和两个变体分别生成用例描述，并依次写入标准答案库。
3. **批改作业**：先按参与者设置匹配标准答案，再按原评分提示词评分；总分按反馈项目 `score_added` 求和。

## Tools、输入与输出

| toolId | 必填输入 | 可选输入 | 输出 |
| --- | --- | --- | --- |
| `sf_usecase_generate_baseline` | `topicText`：题目/需求文本 | `teacherDescTemplate`：用例描述模板 | 基础答案预览文本 |
| `sf_usecase_generate_standards` | `seedAnswer`：教师答案中的参与者和用例 | `teacherDesc`：教师用例描述模板 | 三份标准答案预览文本 |
| `sf_usecase_grade_assignment` | `assignmentContent`：学生作业 | 无 | 最终得分、匹配依据、得分明细、总结和建议 |

标准答案库保存在插件 Service 实例内存中，与原程序的进程内 `GLOBAL_STANDARDS` 对应。先调用任一答案生成 Tool，再调用批改 Tool。插件进程重启后内存状态清空，需要重新生成标准答案。插件不生成 JSON 标准答案文件，也不要求批改调用者额外传入标准答案数组。

评分维度及规则沿用原程序：用例图 40 分，用例描述 60 分；总分根据模型返回的详细反馈中 `score_added` 累加。评分结果包含标准答案匹配名称和原因、得分明细、批改总结及改进建议。

## 运行环境与构建

当前目标基线依据组内材料：Node.js 24+、DSH `0.2.1-alpha.2`、Runtime 0.4.0、Runtime SDK 0.4.1。Runtime README 说明 DSH 0.2.2 尚未适配，请勿据此宣称兼容 DSH 0.2.2。

源码按组内 `software-factory-x-req-split` 的 Cordis Service 工程结构组织。插件携带 Runtime SDK；构建脚本使用 Node.js 内置 TypeScript 类型剥离生成 `lib/*.js`。在插件目录运行：

```powershell
node scripts/build.mjs
```

该构建只转译 TypeScript，不执行独立的静态类型检查。插件运行时使用 DSH 宿主提供的 Cordis 和 DSH Tools 模块。安装插件前应先启用 Runtime。

## 调用示例

生成基础答案：

```json
{
  "topicText": "设计一个图书管理系统，读者可以查询、借阅和归还图书；管理员可以上架图书。"
}
```

生成标准答案库：

```json
{
  "seedAnswer": "参与者：读者、图书管理员\n用例：查询图书、借阅图书、归还图书、上架图书",
  "teacherDesc": "用例名称：借阅图书……"
}
```

批改作业：

```json
{
  "assignmentContent": "参与者：读者、图书管理员\n用例：查询图书、借阅图书……"
}
```

## 源码

- `src/index.ts`：Cordis Service 与三个 Run Tool 注册。
- `src/workflows.ts`：原项目的答案生成、变体审核、答案匹配和评分流程。
- `src/llm.ts`：Runtime SDK 模型调用及 JSON/文本解析。
- `cordis.patch.yml`：DSH Bundle 插件挂载配置。
- `scripts/build.mjs`：构建 DSH 加载的 JavaScript 文件。

## 验证状态

此前完成过严格 TypeScript 类型检查、三条业务流程的假模型验证，以及 DSH `0.2.1-alpha.2` + Runtime `0.4.0` 的本机加载验证。真实模型端到端调用仍需配置可用模型后验证。
