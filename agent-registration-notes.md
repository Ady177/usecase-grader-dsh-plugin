# Agent 登记资料说明

此文件与 `agent-registration.json` 一起交给维护者。JSON 是登记内容，不是 HugeGraph API 请求，也不会在插件运行时自动写入数据库。正式登记由平台 Manage/维护者按当前字段元数据审核。

| 登记项 | 本插件资料 | 说明 |
|---|---|---|
| Agent ID | 未填写 | 新建 Agent 的逻辑 ID 由平台按实际登记流程创建；不伪造 |
| Agent 名称 | UML用例模型智能批改 | 已填写 |
| Agent 版本 | v0.2.1 | 与插件 package.json 版本一致 |
| 启用状态 | 未填写 | 由登记/审核流程决定；草稿不可表示为 enabled |
| 开发人员 | Ady177 | 使用仓库所有者账号标识 |
| 调用方式 | dsh_tool | 原生 DSH Run Tool |
| 调用入口 | sf_usecase_grader | 必须与插件实际注册的 toolId 一致 |
| 性能证据 | simulation | 仅记录假模型流程验证；不是准确率/真实模型效果 |
| 运行条件 | Node.js >=24、DSH 0.2.1-alpha.2、Runtime 0.4.0、SDK 0.4.1 | 目标基线；新宿主版本需重新验收 |
| 模型依赖 | 未声明固定模型 | 模型由任务发起方选择，经 Runtime SDK 继承；不绑定厂商 |
| 版本优选策略 | 未填写 | 尚无多版本选优规则 |
| Agent 能力描述 | 已填写 | 说明标准答案准备、匹配和批改 |
| 版本能力描述 | 已填写 | 说明单工具和按 Run 隔离执行 |
| 处理对象类别 | 已填写 | 课程题目、UML 作业、参考答案、批改报告 |
| 输入规格 | 已填写 | 与实际 Tool JSON Schema 一致；业务校验题目/教师答案至少一个 |
| 输出规格 | 已填写 | 文本报告与 files artifact ID |
| 中间产物 | 已填写 | 路径模式与代码落盘内容对应 |
| 输入快照 | Runtime 自动保存为 `input/request.json` | 不由插件复制或登记为 intermediate |
| 运行代价 | 未填写 | 没有可核实的成本测量 |
| 任务效果 | 未填写 | 没有真实任务效果实测数据 |

平台如强制要求 `agent_id`、`status` 或版本 vertexId，应由 Manage 创建/查询后补入；不要把这些平台生成值写成猜测值。JSON 内 `*_json` 属性写入 HugeGraph 时，按平台入库边界对各字段值序列化；业务插件不直接操作数据库。
