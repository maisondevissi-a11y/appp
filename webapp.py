import os
import sys
import json
import uuid
import time

from flask import Flask, request, jsonify
from flask_cors import CORS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
CHATS_DIR = os.path.join(BASE_DIR, "chats")
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(CHATS_DIR, exist_ok=True)

app = Flask(__name__)
CORS(app)

tok = None
model = None
sample_next_token_fn = None
generate_best_of_n_fn = None
web_search_module = None
current_model_name = None


def list_models():
    if not os.path.isdir(MODELS_DIR):
        return []
    names = []
    for entry in sorted(os.listdir(MODELS_DIR)):
        model_dir = os.path.join(MODELS_DIR, entry)
        if os.path.isdir(model_dir) and os.path.exists(os.path.join(model_dir, "adam_weights.npz")):
            names.append(entry)
    return names


def load_model(model_name):
    global tok, model, sample_next_token_fn, generate_best_of_n_fn, web_search_module, current_model_name

    model_dir = os.path.join(MODELS_DIR, model_name)

    for modname in ["main", "model", "tokenizer", "generate", "optimizer", "web_search"]:
        if modname in sys.modules:
            del sys.modules[modname]

    sys.path.insert(0, model_dir)
    try:
        import tokenizer as tokenizer_mod
        import model as model_mod
        import generate as generate_mod
        try:
            import web_search as web_search_mod
        except ImportError:
            web_search_mod = None
    finally:
        sys.path.remove(model_dir)

    tok = tokenizer_mod.BPETokenizer()
    tok.load(os.path.join(model_dir, "adam_tokenizer.json"))

    model = model_mod.GPT.load_new(os.path.join(model_dir, "adam_weights.npz"))
    sample_next_token_fn = generate_mod.sample_next_token
    generate_best_of_n_fn = getattr(generate_mod, "generate_best_of_n", None)
    web_search_module = web_search_mod
    current_model_name = model_name


def chat_reply_normal(history_ids, max_new_tokens=60, temperature=0.8, top_k=40):
    start_len = len(history_ids)
    token_ids = list(history_ids)

    for _ in range(max_new_tokens):
        context = token_ids[-model.max_seq_len:]
        logits = model.forward(context)
        logits_last = logits[-1]
        next_token, _ = sample_next_token_fn(logits_last, temperature, top_k)
        token_ids.append(next_token)

    new_ids = token_ids[start_len:]
    return new_ids


def chat_reply_pro(history_ids, n=4, max_new_tokens=80, temperature=0.7, top_k=40, repetition_penalty=1.3):
    if generate_best_of_n_fn is None:
        return chat_reply_normal(history_ids, max_new_tokens, temperature, top_k)
    new_ids, score = generate_best_of_n_fn(
        model, history_ids, n=n, max_new_tokens=max_new_tokens,
        temperature=temperature, top_k=top_k, repetition_penalty=repetition_penalty,
    )
    return new_ids


def list_chats():
    files = [f for f in os.listdir(CHATS_DIR) if f.endswith(".json")]
    chats = []
    for fname in files:
        path = os.path.join(CHATS_DIR, fname)
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        chats.append({
            "id": fname[:-5],
            "title": data.get("title", "Sans titre"),
            "updated_at": data.get("updated_at", ""),
            "favorite": data.get("favorite", False),
        })
    chats.sort(key=lambda c: c["updated_at"], reverse=True)
    return chats


def load_chat(chat_id):
    path = os.path.join(CHATS_DIR, f"{chat_id}.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_chat(chat_id, data):
    data["updated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    path = os.path.join(CHATS_DIR, f"{chat_id}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def new_chat():
    chat_id = uuid.uuid4().hex[:8]
    data = {
        "title": "Nouvelle conversation",
        "model_checkpoint": current_model_name,
        "favorite": False,
        "messages": [],
        "history_ids": [],
    }
    save_chat(chat_id, data)
    return chat_id, data


@app.route("/api/models", methods=["GET"])
def api_list_models():
    return jsonify({"models": list_models(), "current": current_model_name})


@app.route("/api/models/select", methods=["POST"])
def api_select_model():
    body = request.get_json()
    name = body.get("name")
    if name not in list_models():
        return jsonify({"error": "modèle introuvable"}), 404
    load_model(name)
    return jsonify({"current": current_model_name})


@app.route("/api/chats", methods=["GET"])
def api_list_chats():
    return jsonify(list_chats())


@app.route("/api/chats/search", methods=["GET"])
def api_search_chats():
    query = request.args.get("q", "").lower().strip()
    if not query:
        return jsonify([])

    results = []
    for chat in list_chats():
        data = load_chat(chat["id"])
        if query in data["title"].lower():
            results.append(chat)
            continue
        for m in data["messages"]:
            if query in m["text"].lower():
                results.append(chat)
                break
    return jsonify(results)


@app.route("/api/chats", methods=["POST"])
def api_new_chat():
    chat_id, data = new_chat()
    return jsonify({"id": chat_id, **data})


@app.route("/api/chats/<chat_id>", methods=["GET"])
def api_get_chat(chat_id):
    try:
        data = load_chat(chat_id)
        return jsonify({"id": chat_id, **data})
    except FileNotFoundError:
        return jsonify({"error": "introuvable"}), 404


@app.route("/api/chats/<chat_id>", methods=["DELETE"])
def api_delete_chat(chat_id):
    path = os.path.join(CHATS_DIR, f"{chat_id}.json")
    if os.path.exists(path):
        os.remove(path)
        return jsonify({"ok": True})
    return jsonify({"error": "introuvable"}), 404


@app.route("/api/chats/<chat_id>/favorite", methods=["POST"])
def api_toggle_favorite(chat_id):
    try:
        data = load_chat(chat_id)
    except FileNotFoundError:
        return jsonify({"error": "introuvable"}), 404
    data["favorite"] = not data.get("favorite", False)
    save_chat(chat_id, data)
    return jsonify({"favorite": data["favorite"]})


@app.route("/api/chats/<chat_id>/message", methods=["POST"])
def api_send_message(chat_id):
    body = request.get_json()
    user_msg = body.get("message", "")
    mode = body.get("mode", "normal")

    try:
        data = load_chat(chat_id)
    except FileNotFoundError:
        return jsonify({"error": "introuvable"}), 404

    history_ids = data["history_ids"]

    web_context = ""
    if mode == "web" and web_search_module is not None:
        try:
            web_context = web_search_module.build_web_context(user_msg)
        except Exception as e:
            web_context = ""

    text_to_encode = (web_context + user_msg + " ") if web_context else (user_msg + " ")
    history_ids = history_ids + tok.encode(text_to_encode)

    if mode == "pro":
        new_ids = chat_reply_pro(history_ids)
    else:
        new_ids = chat_reply_normal(history_ids)

    reply = tok.decode(new_ids)
    history_ids = history_ids + new_ids

    data["history_ids"] = history_ids
    data["messages"].append({"role": "user", "text": user_msg})
    data["messages"].append({"role": "adam", "text": reply, "mode": mode})

    if data["title"] == "Nouvelle conversation":
        data["title"] = user_msg[:40]

    save_chat(chat_id, data)

    return jsonify({"reply": reply, "title": data["title"], "web_used": bool(web_context)})


@app.route("/")
def status():
    return jsonify({"status": "ok", "model": current_model_name})


if __name__ == "__main__":
    models = list_models()
    if not models:
        print("Aucun modèle dans models/")
        print(f"Attendu: {os.path.join(MODELS_DIR, '<nom>', 'adam_weights.npz')}")
        exit(1)

    print(f"Modèles détectés: {models}")
    print("Chargement modèle")
    load_model(models[0])
    print("Serveur: http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=False)
