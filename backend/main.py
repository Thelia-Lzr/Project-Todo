"""Python backend that powers Gemini and DeepSeek interactions."""

from __future__ import annotations

import json
import os
import re
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import google.generativeai as genai
import pytz
import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS


load_dotenv()

app = Flask(__name__)
CORS(app)

MODEL_NAME = os.getenv('GEMINI_MODEL_NAME', 'gemini-2.5-flash')
DEEPSEEK_MODEL_DEFAULT = os.getenv('DEEPSEEK_MODEL_DEFAULT', 'deepseek-chat')
DEFAULT_PORT = int(os.getenv('PORT', 5000))
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
OPENROUTER_REFERER = os.getenv('OPENROUTER_REFERER', 'https://github.com/Thelia-Lzr/Project-Todo')
OPENROUTER_APP_NAME = os.getenv('OPENROUTER_APP_NAME', 'TodoList AI Assistant')
MAX_TOKENS_DEFAULT = int(os.getenv('MAX_TOKENS_DEFAULT', '900'))
# Constants for OpenRouter settings keys
openrouter_setting_keys = (
    'openrouter_api_key',
    'openrouter_default_model',
    'openrouter_model_options',
)

chat_sessions: Dict[str, Any] = {}


def _db_path() -> str:
    return str((Path(__file__).resolve().parent.parent / 'database.db').resolve())


def get_server_deepseek_key() -> Optional[str]:
    env_key = os.getenv('DEEPSEEK_API_KEY')
    if env_key:
        return env_key

    db_path = _db_path()
    if not os.path.exists(db_path):
        return None

    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT value FROM admin_settings WHERE key = ? LIMIT 1", ('deepseek_api_key',))
        row = cur.fetchone()
        conn.close()
        if row and row[0]:
            return row[0]
    except Exception:
        return None
    return None


def parse_model_options(raw_value: Optional[str]) -> List[str]:
    if not raw_value:
        return []

    value = raw_value.strip()
    if not value:
        return []

    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except Exception:
        pass

    parts = re.split(r'[\n,]+', value)
    return [part.strip() for part in parts if part.strip()]


def get_openrouter_settings() -> Dict[str, Any]:
    config = {
        'api_key': (os.getenv('OPENROUTER_API_KEY') or '').strip(),
        'default_model': (os.getenv('OPENROUTER_DEFAULT_MODEL') or '').strip(),
        'model_options': parse_model_options(os.getenv('OPENROUTER_MODEL_OPTIONS', '')),
    }

    db_path = _db_path()
    if os.path.exists(db_path):
        conn = None
        try:
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute(
                "SELECT key, value FROM admin_settings WHERE key IN (?, ?, ?)",
                openrouter_setting_keys,
            )
            rows = cur.fetchall()
            for key, value in rows:
                if key == 'openrouter_api_key' and value:
                    config['api_key'] = value.strip()
                elif key == 'openrouter_default_model' and value:
                    config['default_model'] = value.strip()
                elif key == 'openrouter_model_options' and value:
                    config['model_options'] = parse_model_options(value)
        except Exception:
            # If the admin_settings table does not exist yet, fall back to env vars silently
            pass
        finally:
            if conn:
                conn.close()

    if not config['default_model']:
        if config['model_options']:
            config['default_model'] = config['model_options'][0]
        elif config['api_key']:
            config['default_model'] = 'openrouter/auto'

    return config


def record_api_usage(user_id: Optional[int], request_text: str, response_text: str, model_name: str) -> None:
    db_path = _db_path()
    if not os.path.exists(db_path):
        return

    request_tokens = len(re.findall(r"\S+", request_text or ''))
    response_tokens = len(re.findall(r"\S+", response_text or ''))
    total_tokens = request_tokens + response_tokens

    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO api_usage (user_id, request_tokens, response_tokens, total_tokens, model_name)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user_id or 0, request_tokens, response_tokens, total_tokens, model_name),
        )
        conn.commit()
        conn.close()
    except Exception:
        # Do not crash the request flow if logging fails.
        pass


def build_system_prompt(todo_context: str = '', client_tz: Optional[str] = None) -> str:
    now = datetime.now()
    try:
        server_dt = now.astimezone()
    except Exception:
        server_dt = now

    server_time_str = server_dt.strftime('%Y年%m月%d日 %H:%M:%S')
    server_tz_name = server_dt.tzname() or 'local'

    if client_tz:
        try:
            tz = pytz.timezone(client_tz)
            user_dt = server_dt.astimezone(tz)
            user_time_str = user_dt.strftime('%Y年%m月%d日 %H:%M:%S')
            time_block = (
                f"服务器当前时间: {server_time_str} ({server_tz_name})\n"
                f"用户时区: {client_tz}\n"
                f"用户本地时间: {user_time_str} ({user_dt.tzname() or client_tz})\n"
                "请以用户时区为准进行所有时间判断。"
            )
        except Exception:
            time_block = (
                f"服务器当前时间: {server_time_str} ({server_tz_name})\n"
                f"用户时区: {client_tz} (解析失败，已回退服务器时区)"
            )
    else:
        time_block = (
            f"当前服务器时间: {server_time_str} ({server_tz_name})\n"
            "若未提供用户时区，请以服务器时间为准。"
        )

    todo_section = todo_context if todo_context else '用户当前没有待办事项'

    return f"""你是一个智能待办事项助手。

{time_block}

【用户的待办事项】
{todo_section}

【命令格式 - 必须遵守】
1. 命令格式：🔧[CMD:COMMAND|参数1|参数2]
2. 仅使用竖线 | 作为分隔符，命令上下各留一空行。
3. 参数中不得包含竖线或 Markdown 语法。
4. 支持命令：ADD、COMPLETE、DELETE、UPDATE、SETDUEDATE。

在提供自然语言建议的同时，仅在需要执行变更时输出相应命令。"""


def extract_gemini_text(resp_obj: Any) -> str:
    if hasattr(resp_obj, 'text') and resp_obj.text:
        return resp_obj.text

    parts = []
    result = getattr(resp_obj, '_result', None)
    if result and getattr(result, 'candidates', None):
        for cand in result.candidates:
            content = getattr(cand, 'content', None)
            if content and getattr(content, 'parts', None):
                for part in content.parts:
                    if hasattr(part, 'text') and part.text:
                        parts.append(part.text)
    return '\n'.join(parts)


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'service': 'python-ai-backend', 'model': MODEL_NAME})


@app.route('/api/gemini/init', methods=['POST'])
def init_gemini():
    try:
        data = request.get_json(silent=True) or {}
        api_key = data.get('api_key')
        if not api_key:
            return jsonify({'success': False, 'error': '未提供API密钥'}), 400

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(MODEL_NAME)
        model.generate_content('ping')
        return jsonify({'success': True, 'model': MODEL_NAME})
    except Exception as exc:
        msg = str(exc)
        status = 401 if 'UNAUTHENTICATED' in msg else 429 if 'RESOURCE_EXHAUSTED' in msg else 400
        return jsonify({'success': False, 'error': msg}), status


@app.route('/api/deepseek/init', methods=['POST'])
def init_deepseek():
    try:
        data = request.get_json(silent=True) or {}
        api_key = data.get('api_key') or get_server_deepseek_key()
        if not api_key:
            return jsonify({'success': False, 'error': '未提供 DeepSeek API 密钥'}), 400

        payload = {
            'model': DEEPSEEK_MODEL_DEFAULT,
            'messages': [
                {'role': 'system', 'content': 'ping check'},
                {'role': 'user', 'content': 'ping'},
            ],
            'max_tokens': 5,
            'temperature': 0.0,
        }
        resp = requests.post(
            'https://api.deepseek.com/v1/chat/completions',
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            json=payload,
            timeout=15,
        )
        if resp.status_code == 200:
            return jsonify({'success': True, 'model': DEEPSEEK_MODEL_DEFAULT})
        return jsonify({'success': False, 'error': resp.text}), 401
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


@app.route('/api/deepseek/status', methods=['GET'])
def deepseek_status():
    key_present = bool(get_server_deepseek_key())
    return jsonify({'status': 'running', 'deepseek_configured': key_present, 'timestamp': datetime.now().isoformat()})


@app.route('/api/openrouter/status', methods=['GET'])
def openrouter_status():
    settings = get_openrouter_settings()
    configured = bool(settings.get('api_key'))
    return jsonify({
        'status': 'running' if configured else 'missing_config',
        'openrouter_configured': configured,
        'default_model': settings.get('default_model'),
        'timestamp': datetime.now().isoformat(),
    })


@app.route('/api/gemini/chat', methods=['POST'])
def gemini_chat():
    try:
        data = request.get_json(silent=True) or {}
        user_message = data.get('message')
        if not user_message:
            return jsonify({'success': False, 'error': '消息不能为空'}), 400

        api_key = data.get('api_key') or GEMINI_API_KEY
        if not api_key:
            return jsonify({'success': False, 'error': '未提供API密钥'}), 400

        session_id = data.get('session_id', 'default')
        todo_context = data.get('todo_context', '')
        client_tz = data.get('timezone')
        user_id = data.get('user_id')

        try:
            genai.configure(api_key=api_key)
        except Exception:
            # Silently continue if configuration fails; errors will surface during actual API calls
            pass

        if session_id not in chat_sessions:
            chat_sessions[session_id] = genai.GenerativeModel(MODEL_NAME).start_chat()

        chat = chat_sessions[session_id]
        system_prompt = build_system_prompt(todo_context, client_tz)
        full_message = f"{system_prompt}\n\n用户消息: {user_message}"
        resp = chat.send_message(full_message)
        text = extract_gemini_text(resp)

        record_api_usage(user_id, user_message, text, MODEL_NAME)

        return jsonify({'success': True, 'message': text, 'session_id': session_id, 'timestamp': datetime.now().isoformat()})
    except Exception as exc:
        msg = str(exc)
        if 'UNAUTHENTICATED' in msg:
            return jsonify({'success': False, 'error': 'API密钥无效或已过期'}), 401
        if 'RESOURCE_EXHAUSTED' in msg:
            return jsonify({'success': False, 'error': 'API配额已超出'}), 429
        return jsonify({'success': False, 'error': msg}), 500


@app.route('/api/deepseek/chat', methods=['POST'])
def deepseek_chat():
    try:
        data = request.get_json(silent=True) or {}
        user_message = data.get('message')
        if not user_message:
            return jsonify({'success': False, 'error': '消息不能为空'}), 400

        api_key = data.get('api_key') or get_server_deepseek_key()
        if not api_key:
            return jsonify({'success': False, 'error': '未提供API密钥（前端或服务器端）'}), 400

        todo_context = data.get('todo_context', '')
        client_tz = data.get('timezone')
        user_id = data.get('user_id')
        model = data.get('model', DEEPSEEK_MODEL_DEFAULT)
        temperature = data.get('temperature', 0.3)
        max_tokens = data.get('max_tokens', MAX_TOKENS_DEFAULT)

        system_prompt = build_system_prompt(todo_context, client_tz)
        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_message},
        ]

        resp = requests.post(
            'https://api.deepseek.com/v1/chat/completions',
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            json={'model': model, 'messages': messages, 'temperature': temperature, 'max_tokens': max_tokens},
            timeout=30,
        )

        if resp.status_code != 200:
            return jsonify({'success': False, 'error': f'DeepSeek API错误: {resp.status_code} {resp.text}'}), resp.status_code

        result = resp.json()
        reply = result.get('choices', [{}])[0].get('message', {}).get('content', '')

        record_api_usage(user_id, user_message, reply, model)

        return jsonify({'success': True, 'message': reply, 'timestamp': datetime.now().isoformat(), 'raw': result})
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


@app.route('/api/openrouter/chat', methods=['POST'])
def openrouter_chat():
    try:
        data = request.get_json(silent=True) or {}
        user_message = data.get('message')
        if not user_message:
            return jsonify({'success': False, 'error': '消息不能为空'}), 400

        settings = get_openrouter_settings()
        api_key = (settings.get('api_key') or '').strip()
        if not api_key:
            return jsonify({'success': False, 'error': 'OpenRouter API Key 未配置，请联系管理员'}), 400

        model = (data.get('model') or settings.get('default_model') or '').strip()
        if not model:
            return jsonify({'success': False, 'error': 'OpenRouter 默认模型未配置，请在管理面板设置'}), 400

        # Validate model against allowed model_options
        allowed_models = settings.get('model_options', [])
        if allowed_models and model not in allowed_models:
            return jsonify({'success': False, 'error': f'不允许使用该模型: {model}'}), 400

        todo_context = data.get('todo_context', '')
        client_tz = data.get('timezone')
        user_id = data.get('user_id')
        
        # Validate temperature parameter
        try:
            temperature = float(data.get('temperature', 0.2))
        except (TypeError, ValueError):
            temperature = 0.2
        if not (0 <= temperature <= 2):
            temperature = max(0, min(temperature, 2))

        # Validate max_tokens parameter
        try:
            max_tokens = int(data.get('max_tokens', MAX_TOKENS_DEFAULT))
        except (TypeError, ValueError):
            max_tokens = 900
        if not (1 <= max_tokens <= 4096):
            max_tokens = max(1, min(max_tokens, 4096))

        system_prompt = build_system_prompt(todo_context, client_tz)
        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_message},
        ]

        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': OPENROUTER_REFERER,
            'X-Title': OPENROUTER_APP_NAME,
        }

        payload = {
            'model': model,
            'messages': messages,
            'temperature': temperature,
            'max_tokens': max_tokens,
        }

        try:
            resp = requests.post(
                'https://openrouter.ai/api/v1/chat/completions',
                headers=headers,
                json=payload,
                timeout=30,
            )
        except requests.exceptions.Timeout:
            return jsonify({'success': False, 'error': 'OpenRouter API 请求超时，请稍后重试'}), 504

        if resp.status_code != 200:
            # Log full error server-side but return generic message to client
            print(f'OpenRouter API error: {resp.status_code} {resp.text}')
            return jsonify({'success': False, 'error': f'OpenRouter API 错误: {resp.status_code}'}), resp.status_code

        result = resp.json()
        reply = result.get('choices', [{}])[0].get('message', {}).get('content', '')

        record_api_usage(user_id, user_message, reply, model)

        return jsonify({
            'success': True,
            'message': reply,
            'timestamp': datetime.now().isoformat(),
            'model': model,
        })
    except requests.exceptions.Timeout:
        return jsonify({'success': False, 'error': 'OpenRouter API 请求超时，请稍后重试'}), 504
    except Exception as exc:
        # Log full error server-side but return generic message to client
        print(f'OpenRouter chat error: {str(exc)}')
        return jsonify({'success': False, 'error': '处理请求时发生错误'}), 500


@app.route('/api/gemini/clear-session', methods=['POST'])
def clear_session():
    data = request.get_json(silent=True) or {}
    session_id = data.get('session_id', 'default')
    if session_id in chat_sessions:
        del chat_sessions[session_id]
        return jsonify({'success': True, 'message': '会话已清除'})
    return jsonify({'success': False, 'error': '会话不存在'}), 404


@app.route('/api/gemini/status', methods=['GET'])
def gemini_status():
    return jsonify({'status': 'running', 'model': MODEL_NAME, 'sessions': len(chat_sessions), 'timestamp': datetime.now().isoformat()})


@app.errorhandler(404)
def not_found(_):
    return jsonify({'success': False, 'error': '端点不存在'}), 404


@app.errorhandler(500)
def internal_error(_):
    return jsonify({'success': False, 'error': '服务器内部错误'}), 500


if __name__ == '__main__':
    print(f"🚀 Python AI backend启动，模型: {MODEL_NAME}，端口: {DEFAULT_PORT}")
    debug = os.getenv('FLASK_DEBUG', '1') == '1'
    app.run(host='127.0.0.1', port=DEFAULT_PORT, debug=debug, use_reloader=False)
