from flask import Flask, session, jsonify, request, render_template, redirect, url_for
import os
from dotenv import load_dotenv
from google import genai
import httpx
load_dotenv()
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_KEY)
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET", "devkey")

PRODUCTS = {
    1: {"name":"CoolAir 3000 (3★)", "price":300, "carbon":150, "alt":(2, 70)},
    2: {"name":"EcoAir X (5★)",    "price":400, "carbon": 70, "alt":(None,0)},
}

def calc_swap_coins(impact_diff: int) -> int:
    return max(1, (impact_diff + 9) // 10)

@app.route("/")
def products():
    return render_template("products.html", products=PRODUCTS)

@app.route("/add/<int:pid>")
def add_to_cart(pid):
    cart = session.get("cart", {})
    cart[str(pid)] = cart.get(str(pid), 0) + 1
    session["cart"] = cart
    return redirect(url_for("products"))

@app.route("/cart")
def view_cart():
    cart = session.get("cart", {})
    items = []
    total = 0
    for pid, qty in cart.items():
        p = PRODUCTS[int(pid)]
        items.append({**p, "id": pid, "qty": qty})
        total += p["price"] * qty
    return render_template("cart.html", items=items, total=total)

@app.route("/api/eco-score", methods=["POST"])
def eco_score():
    cart = request.json.get("items", [])
    recs, coins_total, score_acc = [], 0, 0
    for it in cart:
        p = PRODUCTS[it["id"]]
        score_acc += p["carbon"] * it["qty"]
        alt_id, alt_carbon = p["alt"]
        if alt_id:
            diff = p["carbon"] - alt_carbon
            coins = calc_swap_coins(diff)
            coins_total += coins * it["qty"]
            recs.append({
                "from_id": it["id"],
                "to_id": alt_id,
                "from_name": p["name"],
                "to_name": PRODUCTS[alt_id]["name"],
                "impact_diff": diff,
                "coins": coins
            })
    eco_score = min(int(score_acc / (len(cart)*200) * 100), 100)
    return jsonify(eco_score=eco_score, recommendations=recs, coins=coins_total)

@app.route("/api/ai-comment", methods=["POST"])
def ai_comment():
    data = request.json or {}
    src = PRODUCTS.get(int(data.get("from_id") or 0))
    tgt = PRODUCTS.get(int(data.get("to_id") or 0))
    if not src or not tgt:
        return jsonify(comment="Invalid product IDs"), 400

    prompt = (
        f"Compare the {src['name']} (emits {src['carbon']} kg CO₂/yr) "
        f"with the {tgt['name']} (emits {tgt['carbon']} kg CO₂/yr). "
        "Give a 3-line friendly summary emphasizing energy savings and carbon impact."
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        choice = response.text
    except Exception as e:
        app.logger.exception("Gemini genai call failed")
        choice = (
            "⚠️ Could not fetch comparison right now. "
            "Please try again in a moment!"
        )

    return jsonify(comment=choice)



@app.route("/api/redeem-coins", methods=["POST"])
def redeem_coins():
    req = request.json or {}
    user = session.setdefault("wallet", {"balance":0, "history":[]})
    amt = int(req.get("coins", 0))
    if amt > user["balance"]:
        return jsonify(error="Not enough coins"), 400
    user["balance"] -= amt
    user["history"].append({"type":"redeem","coins":amt})
    return jsonify(balance=user["balance"])

@app.route("/wallet")
def wallet():
    w = session.setdefault("wallet", {"balance":0, "history":[]})
    return render_template("wallet.html", wallet=w)

if __name__ == "__main__":
    app.run(debug=True)