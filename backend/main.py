"""
Python Gemini AI Backend
Flask应用，处理Gemini AI聊天请求
"""

import os
import json
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai

# 加载环境变量
load_dotenv()

# 初始化Flask应用
app = Flask(__name__)
CORS(app)

# 配置Gemini API
API_KEY = os.getenv('GEMINI_API_KEY')
if not API_KEY:
    raise ValueError("❌ 未设置 GEMINI_API_KEY 环境变量")

genai.configure(api_key=API_KEY)

# 使用 Gemini 2.5 Flash - 稳定版本
MODEL_NAME = "gemini-2.5-flash"

# 全局聊天会话存储（生产环境应使用数据库）
chat_sessions = {}


@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    return jsonify({
        'status': 'ok',
        'service': 'Python Gemini Backend',
        'model': MODEL_NAME
    })


@app.route('/api/gemini/init', methods=['POST'])
def init_gemini():
    """初始化Gemini API（验证API密钥）"""
    try:
        data = request.json
        api_key = data.get('api_key')
        
        if not api_key:
            return jsonify({
                'success': False,
                'error': '未提供API密钥'
            }), 400
        
        # 测试API密钥
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(MODEL_NAME)
        
        # 尝试生成简单内容来验证密钥
        response = model.generate_content("Hello")
        
        return jsonify({
            'success': True,
            'message': 'API密钥验证成功',
            'model': MODEL_NAME
        })
    
    except Exception as e:
        error_msg = str(e)
        if 'UNAUTHENTICATED' in error_msg:
            return jsonify({
                'success': False,
                'error': 'API密钥无效'
            }), 401
        elif 'RESOURCE_EXHAUSTED' in error_msg:
            return jsonify({
                'success': False,
                'error': 'API额度已用尽'
            }), 429
        else:
            return jsonify({
                'success': False,
                'error': f'验证失败: {error_msg}'
            }), 400


@app.route('/api/gemini/chat', methods=['POST'])
def gemini_chat():
    """处理Gemini AI聊天请求"""
    try:
        data = request.json
        try:
            masked = dict(data) if isinstance(data, dict) else {}
            if 'api_key' in masked:
                masked['api_key'] = '***'
            print(f"🔍 调试 - 收到的完整请求数据 (masked): {masked}")
        except Exception:
            print("🔍 调试 - 收到的完整请求数据: <unprintable>")
        user_message = data.get('message')
        session_id = data.get('session_id', 'default')
        api_key = data.get('api_key')
        todo_context = data.get('todo_context', '')
        user_id = data.get('user_id')
        print(f"🔍 调试 - 解析后的user_id: {user_id}, 类型: {type(user_id)}")
        
        if not user_message:
            return jsonify({
                'success': False,
                'error': '消息不能为空'
            }), 400
        
        if not api_key:
            return jsonify({
                'success': False,
                'error': '未提供API密钥'
            }), 400
        
        # 为此会话配置API
        genai.configure(api_key=api_key)
        
        # 获取或创建聊天会话
        if session_id not in chat_sessions:
            model = genai.GenerativeModel(MODEL_NAME)
            chat_sessions[session_id] = model.start_chat()
        
        chat = chat_sessions[session_id]
        
        # 获取当前时间 - 用于 AI 的时间判断
        from datetime import datetime
        current_time = datetime.now()
        #time_info = f"""当前时间: {current_time.strftime('%Y年%m月%d日 %H:%M:%S')} ({current_time.strftime('%A')})"""
        
        # 获取当前时间与时区信息（容错处理，优先用前端传来的 timezone）
        client_tz = data.get('timezone') if isinstance(data, dict) else None
        import pytz
        try:
            server_dt = current_time.astimezone()
            server_time_str = server_dt.strftime('%Y年%m月%d日 %H:%M:%S')
            server_tz_name = server_dt.tzname() or 'local'
        except Exception:
            server_dt = current_time
            server_time_str = server_dt.strftime('%Y年%m月%d日 %H:%M:%S')
            server_tz_name = 'UTC'

        if client_tz:
            try:
                user_tz = pytz.timezone(client_tz)
                user_dt = server_dt.astimezone(user_tz)
                user_time_str = user_dt.strftime('%Y年%m月%d日 %H:%M:%S')
                user_tz_name = user_dt.tzname() or client_tz
                time_info = (
                    f"服务器当前时间: {server_time_str} ({server_tz_name})\n"
                    f"用户时区: {client_tz}\n"
                    f"用户本地时间: {user_time_str} ({user_tz_name})\n"
                    "请以用户时区（上面所列）为准进行所有时间判断、优先级评估和建议。"
                    "如果用户时区不可用或格式不正确，请回退到服务器本地时间。"
                )
                tz_note = f"（主要使用用户时区: {client_tz}；如不可用则使用服务器时区 {server_tz_name}）"
            except Exception:
                time_info = (
                    f"服务器当前时间: {server_time_str} ({server_tz_name})\n"
                    f"用户时区: {client_tz} (解析失败，已回退)\n"
                    "请以服务器本地时间为准进行所有时间判断。"
                )
                tz_note = f"（用户时区解析失败，使用服务器时区: {server_tz_name}）"
        else:
            time_info = f"当前服务器时间: {server_time_str} ({server_tz_name})\n请以服务器本地时间为准进行所有时间判断，除非用户明确说明其他时区。"
            tz_note = f"（使用服务器时区: {server_tz_name}）"

            # 构建系统提示和上下文 - 包含时区说明
            system_prompt = f"""你是一个智能待办事项助手。

    {time_info}
    (请根据用户本地时间进行所有时间相关推理和命令处理，无需向用户反复说明时区。注意：同一用户可能在不同请求中处于不同的时区。)

    【用户的待办事项】
{todo_context if todo_context else '用户当前没有待办事项'}

【你可以使用的命令】
你可以在回复中使用以下命令来操作用户的待办事项。

⚠️  **命令格式规则（务必遵守）**：
1. 命令格式必须严格为：🔧[CMD:COMMAND|参数1|参数2]
   - 🔧 是emoji图标（必须）
   - [CMD: 是固定前缀（必须）
   - 参数之间用竖线 | 分隔（不是制表符、空格或其他符号）
   - 例如正确: 🔧[CMD:ADD|完成报告]
   - 例如错误: 🔧[CMD:ADD	完成报告] (这个用的是制表符，会出错！)
   
2. 命令前后各一行空行，确保独立显示
3. 参数值中不要包含竖线 | 符号
4. 不要在命令行中混入其他Markdown符号
5. 每个命令单独占一行
6. 命令会被自动识别和执行，用户看不到命令代码，只看到执行结果

【支持的5个命令】

1️⃣  添加待办事项
   命令格式: 🔧[CMD:ADD|任务名称|截止时间]
   参数: 
   - 任务名称 (必须，任意文本)
   - 截止时间 (可选，格式: YYYY-MM-DD HH:mm)
   
   例如（仅创建任务）：
   🔧[CMD:ADD|完成项目报告]
   
   例如（创建任务并设置时间）：
   🔧[CMD:ADD|完成项目报告|2025-10-25 18:00]
   
   **推荐用法**: 创建任务时就设置截止时间，一步到位！

2️⃣  标记任务完成
   命令格式: 🔧[CMD:COMPLETE|任务ID]
   参数: 任务ID (必须，数字)
   例如：
   
   🔧[CMD:COMPLETE|1]

3️⃣  删除任务
   命令格式: 🔧[CMD:DELETE|任务ID]
   参数: 任务ID (必须，数字)
   例如：
   
   🔧[CMD:DELETE|2]

4️⃣  更新任务名称
   命令格式: 🔧[CMD:UPDATE|任务ID|新任务名称]
   参数: 任务ID (数字) | 新任务名称 (文本)
   例如：
   
   🔧[CMD:UPDATE|1|改进后的项目报告]

5️⃣  设置截止时间
   命令格式: 🔧[CMD:SETDUEDATE|任务ID|YYYY-MM-DD HH:mm]
   参数: 任务ID (数字) | 截止时间 (格式必须是 YYYY-MM-DD HH:mm)
   特殊用法: 可以用 @ 或 @latest 代替任务ID，表示最后创建的任务
   例如设置最新创建的任务:
   
   🔧[CMD:SETDUEDATE|@|2025-10-25 18:00]
   或
   🔧[CMD:SETDUEDATE|@latest|2025-10-25 18:00]

【创建任务并设置时间的两种方法】

方法一（推荐）：直接在ADD命令中设置时间
   这是最简单的方法，一行命令搞定：
   
   🔧[CMD:ADD|完成项目报告|2025-10-25 18:00]
   
   优点：简洁高效，一步到位！

方法二：分两步执行
   先创建任务，再用 @latest 设置时间：
   
   🔧[CMD:ADD|完成项目报告]
   
   🔧[CMD:SETDUEDATE|@latest|2025-10-25 18:00]
   
   优点：灵活性高，可以先创建再设置

**重要**: 优先使用方法一（ADD命令直接设置时间），除非需要特殊处理或延迟设置时间。

【重要提醒】
- ❌ 错误示例: 🔧[CMD:ADD	课程] (使用了制表符)
- ✅ 正确示例: 🔧[CMD:ADD|课程] (使用管道符|)
- 参数用 | 分隔，不用空格、制表符或其他符号
- 命令行本身不要加说明注释

【你的职责】
1. **主动分析用户需求**：
   - 理解用户的显式需求（直接要求）
   - 推断用户的隐式需求（可能的真实意图）
   - 识别可以改进的地方

2. **积极给出建议**：
   - 分析当前待办列表的问题（重复、过期、优先级混乱等）
   - 提出改进建议（可以细化任务、合并相似任务、设置截止时间等）
   - 主动提示用户可能遗漏的任务

3. **执行用户的隐含需求**：
   - 用户说"整理一下"，你应该：
     - 分析任务的合理性
     - 合并重复或相似的任务
     - 为没有截止时间的重要任务设置截止时间
     - 删除已过期或不合理的任务
   
   - 用户说"我太忙了"，你应该：
     - 识别哪些任务可以延后
     - 标记最紧急的任务
     - 建议删除可选任务

   - **创建任务时同时设置时间**：
     - 使用 @latest 或 @ 来指代刚创建的任务
     - 这样可以在一个流程中同时创建和设置时间
     - 例子：
       🔧[CMD:ADD|完成报告]
       🔧[CMD:SETDUEDATE|@latest|2025-10-25 18:00]
     - 这会创建任务并立即设置截止时间

4. **在执行命令时解释原因**：
   - 不仅仅执行命令，要说明为什么这样做
   - 例如："我将X任务设置为明天晚上完成，因为这是你最近经常提到的"

【建议和编辑的例子】

用户: "我的任务太多了"
❌ 错误做法: 只是说"是的，你有很多任务"
✅ 正确做法: 
   "我看到你有10个任务。我的建议是：
   - '购物'和'买菜'可以合并为'采购生活用品'
   - '学习Python'和'Python教程'重复了，可以删除一个
   - 以下3个任务已超期，需要更新：..."
   然后执行这些编辑

用户: "帮我规划今天"
❌ 错误做法: 只列出今天的任务
✅ 正确做法:
   "根据当前任务和截止时间，今天应该优先做：
   1. 完成项目报告（18:00 截止）
   2. 准备会议材料（16:00 截止）
   然后为这些任务设置截止时间，标记为重要"
   然后通过命令执行这些操作

用户: "帮我创建一个待办事项，完成后的期限是今天晚上6点"
✅ 正确做法（方法一，推荐）:
   "我为你创建新任务并设置时间：
   
   🔧[CMD:ADD|完成今天的工作|2025-10-24 18:00]
   
   任务已创建，截止时间设置为今天晚上6点"

✅ 正确做法（方法二）:
   "我为你创建新任务并设置时间：
   
   🔧[CMD:ADD|完成今天的工作]
   
   🔧[CMD:SETDUEDATE|@latest|2025-10-24 18:00]
   
   任务已创建，截止时间设置为今天晚上6点"

用户: "明天下午3点前要交报告"
✅ 正确做法:
   "我为你添加任务：
   
   🔧[CMD:ADD|交报告|2025-10-25 15:00]
   
   已设置截止时间为明天下午3点"

现在处理用户的请求。结合你的分析，主动给出建议和执行改进，不仅仅是被动响应！"""
        
        # 发送消息
        full_message = f"{system_prompt}\n\n用户消息: {user_message}"
        response = chat.send_message(full_message)
        
        # 记录API使用情况（增强：即使没有usage_metadata或user_id也会记录，便于统计请求次数）
        try:
            user_id = data.get('user_id')
            print(f"🔍 调试 - user_id: {user_id}")
            print(f"🔍 调试 - response类型: {type(response)}")
            print(f"🔍 调试 - response所有属性: {dir(response)}")

            # 如果前端未提供 user_id，尝试从 session_id 中推断用户名并查询用户ID（例如 session_id: Thelia_123...）
            try:
                if (user_id is None or user_id == '') and session_id:
                    possible_name = None
                    if isinstance(session_id, str) and '_' in session_id:
                        possible_name = session_id.split('_', 1)[0]
                    if possible_name:
                        try:
                            # 查询 users 表获取 id
                            import sqlite3 as _sqlite
                            db_path_tmp = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database.db')
                            conn_tmp = _sqlite.connect(db_path_tmp)
                            cur_tmp = conn_tmp.cursor()
                            cur_tmp.execute('SELECT id FROM users WHERE username = ? LIMIT 1', (possible_name,))
                            row = cur_tmp.fetchone()
                            conn_tmp.close()
                            if row:
                                user_id = row[0]
                                print(f"🔍 调试 - 从session_id推断到user_id: {user_id} (username={possible_name})")
                        except Exception as e:
                            print(f"🔍 调试 - 从session_id推断user_id时出错: {e}")
            except Exception as e:
                print(f"🔍 调试 - session_id推断user_id失败: {e}")

            # 获取响应文本（兼容多种response结构）
            resp_text = ''
            try:
                if hasattr(response, 'text') and response.text:
                    resp_text = response.text
                else:
                    # 尝试从内部_result -> candidates -> content -> parts 中提取文本
                    parts = []
                    if hasattr(response, '_result') and response._result:
                        res = response._result
                        if hasattr(res, 'candidates') and res.candidates:
                            for c in getattr(res, 'candidates') or []:
                                # content.parts
                                if hasattr(c, 'content') and getattr(c, 'content') is not None:
                                    content = c.content
                                    if hasattr(content, 'parts') and content.parts:
                                        for p in getattr(content, 'parts') or []:
                                            if hasattr(p, 'text'):
                                                parts.append(p.text)
                    if parts:
                        resp_text = '\n'.join(parts)
            except Exception as e:
                print(f"🔍 调试 - 提取响应文本失败: {e}")

            # 估算token（简化为词数统计，确保能记录请求次数和大致消耗）
            import re, sqlite3
            def word_count(s):
                return len(re.findall(r"\S+", s)) if s else 0

            request_tokens = word_count(user_message) if user_message else 0
            response_tokens = word_count(resp_text)
            total_tokens = request_tokens + response_tokens

            # 如果没有user_id，使用0作为匿名用户ID，仍然记录以统计请求量
            uid = user_id if (user_id is not None) else 0

            db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database.db')
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()

            cursor.execute('''
                INSERT INTO api_usage (user_id, request_tokens, response_tokens, total_tokens, model_name)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                uid,
                request_tokens,
                response_tokens,
                total_tokens,
                MODEL_NAME
            ))

            conn.commit()
            conn.close()
            print(f"✅ 记录API使用: request={request_tokens}, response={response_tokens}, total={total_tokens} (用户ID: {uid})")
        except Exception as log_error:
            print(f"⚠️  记录API使用失败: {log_error}")
            import traceback
            traceback.print_exc()
        
        return jsonify({
            'success': True,
            'message': response.text,
            'session_id': session_id,
            'timestamp': datetime.now().isoformat()
        })
    
    except Exception as e:
        error_msg = str(e)
        print(f"❌ 错误: {error_msg}")
        
        # 错误分类
        if 'UNAUTHENTICATED' in error_msg:
            return jsonify({
                'success': False,
                'error': 'API密钥无效或已过期'
            }), 401
        elif 'RESOURCE_EXHAUSTED' in error_msg:
            return jsonify({
                'success': False,
                'error': 'API配额已超出，请稍后重试'
            }), 429
        elif 'INVALID_ARGUMENT' in error_msg:
            return jsonify({
                'success': False,
                'error': '请求参数无效'
            }), 400
        else:
            return jsonify({
                'success': False,
                'error': f'聊天失败: {error_msg}'
            }), 500


@app.route('/api/gemini/clear-session', methods=['POST'])
def clear_session():
    """清除聊天会话"""
    try:
        data = request.json
        session_id = data.get('session_id', 'default')
        
        if session_id in chat_sessions:
            del chat_sessions[session_id]
            return jsonify({
                'success': True,
                'message': '会话已清除'
            })
        else:
            return jsonify({
                'success': False,
                'error': '会话不存在'
            }), 404
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/gemini/status', methods=['GET'])
def status():
    """获取Gemini服务状态"""
    return jsonify({
        'status': 'running',
        'model': MODEL_NAME,
        'sessions': len(chat_sessions),
        'timestamp': datetime.now().isoformat()
    })


@app.errorhandler(404)
def not_found(error):
    """404错误处理"""
    return jsonify({
        'success': False,
        'error': '端点不存在'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """500错误处理"""
    return jsonify({
        'success': False,
        'error': '服务器内部错误'
    }), 500


if __name__ == '__main__':
    print("=" * 60)
    print("🚀 Python Gemini AI 后端启动")
    print("=" * 60)
    print(f"📍 模型: {MODEL_NAME}")
    print(f"🔌 端口: 5000")
    print(f"⚙️  环境: {os.getenv('FLASK_ENV', 'production')}")
    print("=" * 60)
    print()
    
    # 启动Flask应用
    app.run(
        host='127.0.0.1',
        port=5000,
        debug=True,
        use_reloader=False  # 禁用重加载，避免重复初始化
    )
