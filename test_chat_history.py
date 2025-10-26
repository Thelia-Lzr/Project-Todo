#!/usr/bin/env python3
"""
测试聊天记录功能 - 验证消息保存和加载
"""

import requests
import time

BASE_URL = "http://localhost:3000/api"

def test_chat_history():
    """测试聊天记录功能"""
    print("=" * 60)
    print("🔍 测试聊天记录功能")
    print("=" * 60)

    # 1. 登录用户
    print("\n1️⃣ 登录用户...")
    login_resp = requests.post(f"{BASE_URL}/auth/login", json={
        "username": "test",
        "password": "123456"
    }, timeout=5)
    
    if login_resp.status_code != 200:
        print(f"❌ 登录失败: {login_resp.text}")
        return False
    
    token = login_resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ 登录成功")

    # 2. 创建聊天会话
    print("\n2️⃣ 创建聊天会话...")
    session_id = "test_session_" + str(int(time.time()))
    
    session_resp = requests.post(f"{BASE_URL}/chat/session", 
        json={"sessionId": session_id},
        headers=headers,
        timeout=5)
    
    if session_resp.status_code not in [200, 201]:
        print(f"❌ 创建会话失败: {session_resp.text}")
        return False
    
    print(f"✅ 会话已创建: {session_id}")

    # 3. 保存用户消息
    print("\n3️⃣ 保存用户消息...")
    user_messages = [
        "你好，请帮我创建一个新的待办事项",
        "计划进行什么操作？",
        "我想明天完成这个任务"
    ]
    
    for i, msg in enumerate(user_messages, 1):
        msg_resp = requests.post(f"{BASE_URL}/chat/message",
            json={
                "sessionId": session_id,
                "role": "user",
                "message": msg
            },
            headers=headers,
            timeout=5)
        
        if msg_resp.status_code != 201:
            print(f"❌ 保存用户消息 {i} 失败: {msg_resp.text}")
            return False
        
        print(f"   ✅ 用户消息 {i} 已保存: {msg}")
        
        # 保存助手回复
        time.sleep(0.5)
        assistant_msg = f"好的，我已收到你的消息: '{msg}'. 正在处理中..."
        asst_resp = requests.post(f"{BASE_URL}/chat/message",
            json={
                "sessionId": session_id,
                "role": "assistant",
                "message": assistant_msg
            },
            headers=headers,
            timeout=5)
        
        if asst_resp.status_code != 201:
            print(f"❌ 保存助手消息 {i} 失败: {asst_resp.text}")
            return False
        
        print(f"   ✅ 助手消息 {i} 已保存")

    # 4. 获取聊天历史
    print("\n4️⃣ 获取聊天历史...")
    history_resp = requests.get(f"{BASE_URL}/chat/history/{session_id}",
        headers=headers,
        timeout=5)
    
    if history_resp.status_code != 200:
        print(f"❌ 获取聊天历史失败: {history_resp.text}")
        return False
    
    history_data = history_resp.json()
    
    if not history_data.get('success'):
        print(f"❌ 获取聊天历史返回成功=false: {history_data}")
        return False
    
    messages = history_data.get('messages', [])
    print(f"✅ 获取了 {len(messages)} 条聊天记录")
    
    # 验证消息
    if len(messages) != 6:  # 3 条用户消息 + 3 条助手消息
        print(f"❌ 期望 6 条消息，实际收到 {len(messages)} 条")
        return False
    
    print("\n📋 聊天记录详情:")
    for i, msg in enumerate(messages, 1):
        role = "👤" if msg['role'] == 'user' else "🤖"
        print(f"   {i}. {role} [{msg['role']}]: {msg['message'][:50]}...")

    # 5. 获取用户的所有会话
    print("\n5️⃣ 获取用户的所有聊天会话...")
    sessions_resp = requests.get(f"{BASE_URL}/chat/sessions",
        headers=headers,
        timeout=5)
    
    if sessions_resp.status_code != 200:
        print(f"❌ 获取会话列表失败: {sessions_resp.text}")
        return False
    
    sessions_data = sessions_resp.json()
    sessions = sessions_data.get('sessions', [])
    
    print(f"✅ 用户有 {len(sessions)} 个聊天会话")
    for session in sessions:
        print(f"   • 会话ID: {session['session_id']}")

    print("\n" + "=" * 60)
    print("✅ 所有聊天记录功能测试通过！")
    print("=" * 60)
    print("\n📝 功能验证：")
    print("   ✅ 会话创建正常")
    print("   ✅ 消息保存正常")
    print("   ✅ 消息记录正确")
    print("   ✅ 聊天历史加载正常")
    print("   ✅ 会话列表查询正常")
    
    return True

if __name__ == "__main__":
    try:
        success = test_chat_history()
        if not success:
            print("\n❌ 聊天记录功能测试失败")
    except Exception as e:
        print(f"\n❌ 测试出错: {e}")
        import traceback
        traceback.print_exc()
