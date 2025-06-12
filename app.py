
from flask import Flask, session, jsonify, request, render_template_string , render_template
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_KEY)
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "devkey")

PRODUCTS = {
    1: {"name": "CoolAir 3000 (3★)", "price": 300, "carbon": 150, "sustainability": 70},
    2: {"name": "EcoAir X (5★)", "price": 400, "carbon": 70, "sustainability": 95},
    3: {"name": "PowerMax AC (2★)", "price": 250, "carbon": 200, "sustainability": 40},
    4: {"name": "GreenBreeze Plus (4★)", "price": 350, "carbon": 90, "sustainability": 85},
}

def calc_coins_reward(sustainability_score):
    """Calculate coins reward based on sustainability score"""
    if sustainability_score >= 90:
        return 20
    elif sustainability_score >= 80:
        return 15
    elif sustainability_score >= 70:
        return 10
    else:
        return 5

@app.route("/")
def home():
    return render_template("layout.html", products=PRODUCTS)

@app.route("/api/add-to-cart", methods=["POST"])
def add_to_cart():
    """Add product to cart and check if AI recommendation needed"""
    data = request.json or {}
    product_id = int(data.get("product_id", 0))
    
    if product_id not in PRODUCTS:
        return jsonify(error="Invalid product"), 400

    cart = session.get("cart", {})
    cart[str(product_id)] = cart.get(str(product_id), 0) + 1
    session["cart"] = cart
    
    product = PRODUCTS[product_id]
    if product["sustainability"] < 80:
        better_alternatives = []
        for pid, p in PRODUCTS.items():
            if pid != product_id and p["sustainability"] > product["sustainability"]:
                carbon_savings = product["carbon"] - p["carbon"]
                better_alternatives.append({
                    "id": pid,
                    "product": p,
                    "carbon_savings": carbon_savings
                })
        
        if better_alternatives:
            best_alt = max(better_alternatives, key=lambda x: x["carbon_savings"])
            ai_comment = generate_ai_recommendation(product, best_alt)
            
            return jsonify(
                success=True,
                added_to_cart=True,
                show_recommendation=True,
                recommendation={
                    "current_product": product,
                    "current_id": product_id,
                    "suggested_product": best_alt["product"],
                    "suggested_id": best_alt["id"],
                    "carbon_savings": best_alt["carbon_savings"],
                    "ai_comment": ai_comment,
                    "price_difference": best_alt["product"]["price"] - product["price"]
                }
            )
    coins_reward = calc_coins_reward(product["sustainability"])
    wallet = session.setdefault("wallet", {"balance": 0, "history": []})
    wallet["balance"] += coins_reward
    wallet["history"].append({
        "type": "eco_purchase",
        "product": product["name"],
        "coins": coins_reward,
        "sustainability": product["sustainability"]
    })
    session["wallet"] = wallet
    
    return jsonify(
        success=True,
        added_to_cart=True,
        show_recommendation=False,
        coins_earned=coins_reward,
        message=f"Great eco-friendly choice! You earned {coins_reward} EcoCoins!"
    )

def generate_ai_recommendation(current_product, best_alternative):
    """Generate AI recommendation using Gemini"""
    prompt = f"""
    A customer just added "{current_product['name']}" to their cart, which produces {current_product['carbon']}kg CO₂ annually and has a sustainability score of {current_product['sustainability']}/100.
    
    We have a better eco-friendly alternative: "{best_alternative['product']['name']}" which only produces {best_alternative['product']['carbon']}kg CO₂ annually and has a sustainability score of {best_alternative['product']['sustainability']}/100.
    
    The customer would save {best_alternative['carbon_savings']}kg CO₂ per year by switching.
    
    Write a friendly, persuasive 2-3 sentence recommendation explaining why they should consider the eco-friendly alternative. 
    Focus on the environmental benefits and make it personal. Be enthusiastic but not pushy. 
    Include specific numbers about the carbon savings and environmental impact.
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        app.logger.exception("Gemini API call failed")
        return f"Consider switching to {best_alternative['product']['name']}! You'll save {best_alternative['carbon_savings']}kg CO₂ annually - that's equivalent to planting {abs(best_alternative['carbon_savings'])//10} trees! 🌱"

@app.route("/api/accept-recommendation", methods=["POST"])
def accept_recommendation():
    """Handle when user accepts AI recommendation"""
    data = request.json or {}
    from_id = int(data.get("from_id", 0))
    to_id = int(data.get("to_id", 0))
    carbon_savings = int(data.get("carbon_savings", 0))
    
    if from_id not in PRODUCTS or to_id not in PRODUCTS:
        return jsonify(error="Invalid products"), 400
    cart = session.get("cart", {})
    if str(from_id) in cart and cart[str(from_id)] > 0:
        cart[str(from_id)] -= 1
        if cart[str(from_id)] == 0:
            del cart[str(from_id)]
    
    cart[str(to_id)] = cart.get(str(to_id), 0) + 1
    session["cart"] = cart
    to_product = PRODUCTS[to_id]
    coins_earned = calc_coins_reward(to_product["sustainability"]) + 10  
    wallet = session.setdefault("wallet", {"balance": 0, "history": []})
    wallet["balance"] += coins_earned
    wallet["history"].append({
        "type": "eco_swap",
        "coins": coins_earned,
        "from_product": PRODUCTS[from_id]["name"],
        "to_product": to_product["name"],
        "carbon_saved": abs(carbon_savings)
    })
    session["wallet"] = wallet
    
    return jsonify(
        success=True,
        coins_earned=coins_earned,
        new_balance=wallet["balance"],
        message=f"Excellent choice! You earned {coins_earned} EcoCoins for making an eco-friendly swap and saving {abs(carbon_savings)}kg CO₂!"
    )

@app.route("/api/get-cart")
def get_cart():
    """Get current cart contents"""
    cart = session.get("cart", {})
    wallet = session.get("wallet", {"balance": 0, "history": []})
    
    cart_items = []
    total_price = 0
    total_carbon = 0
    
    for product_id, quantity in cart.items():
        product = PRODUCTS[int(product_id)]
        item_total = product["price"] * quantity
        item_carbon = product["carbon"] * quantity
        
        cart_items.append({
            "id": int(product_id),
            "name": product["name"],
            "price": product["price"],
            "quantity": quantity,
            "total": item_total,
            "carbon": product["carbon"],
            "total_carbon": item_carbon,
            "sustainability": product["sustainability"]
        })
        
        total_price += item_total
        total_carbon += item_carbon
    
    return jsonify(
        cart_items=cart_items,
        total_price=total_price,
        total_carbon=total_carbon,
        eco_coins=wallet["balance"]
    )

@app.route("/api/apply-discount", methods=["POST"])
def apply_discount():
    """Apply EcoCoins discount to cart"""
    data = request.json or {}
    coins_to_use = int(data.get("coins", 0))
    
    wallet = session.get("wallet", {"balance": 0, "history": []})
    
    if coins_to_use > wallet["balance"]:
        return jsonify(error="Not enough EcoCoins"), 400
    discount_amount = coins_to_use
    
    wallet["balance"] -= coins_to_use
    wallet["history"].append({
        "type": "discount_applied",
        "coins": coins_to_use,
        "discount": discount_amount
    })
    session["wallet"] = wallet
    
    return jsonify(
        success=True,
        discount_applied=discount_amount,
        remaining_coins=wallet["balance"],
        message=f"Applied ${discount_amount} discount using {coins_to_use} EcoCoins!"
    )

@app.route("/api/checkout", methods=["POST"])
def checkout():
    """Process checkout"""
    cart = session.get("cart", {})
    
    if not cart:
        return jsonify(error="Cart is empty"), 400
    total_carbon_saved = 0
    eco_friendly_purchases = 0
    
    for product_id, quantity in cart.items():
        product = PRODUCTS[int(product_id)]
        if product["sustainability"] >= 80:
            eco_friendly_purchases += quantity
            total_carbon_saved += (150 - product["carbon"]) * quantity
    session["cart"] = {}
    
    return jsonify(
        success=True,
        message="Checkout successful! Thank you for shopping sustainably!",
        environmental_impact={
            "carbon_saved": max(0, total_carbon_saved),
            "eco_friendly_purchases": eco_friendly_purchases
        }
    )

if __name__ == "__main__":
    app.run(debug=True)