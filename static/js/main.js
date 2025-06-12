const PRODUCTS = {
  1: { name: "CoolAir 3000 (3★)", price: 300, carbon: 150, sustainability: 70 },
  2: { name: "EcoAir X (5★)", price: 400, carbon: 70, sustainability: 95 },
  3: { name: "PowerMax AC (2★)", price: 250, carbon: 200, sustainability: 40 },
  4: {
    name: "GreenBreeze Plus (4★)",
    price: 350,
    carbon: 90,
    sustainability: 85,
  },
};

let currentRecommendation = null;
let cartVisible = false;
document.addEventListener("DOMContentLoaded", function () {
  loadProducts();
  updateCartDisplay();
});

function loadProducts() {
  const grid = document.getElementById("productsGrid");
  grid.innerHTML = "";

  Object.entries(PRODUCTS).forEach(([id, product]) => {
    const sustainabilityClass =
      product.sustainability >= 80
        ? "high-sustainability"
        : product.sustainability >= 70
        ? "medium-sustainability"
        : "low-sustainability";

    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
                    <div class="sustainability-badge ${sustainabilityClass}">
                        ${product.sustainability}% Sustainable
                    </div>
                    <div class="product-name">${product.name}</div>
                    <div class="product-stats">
                        <div class="stat">
                            <div class="stat-label">Annual Carbon</div>
                            <div class="stat-value">${product.carbon}kg CO₂</div>
                        </div>
                        <div class="stat">
                            <div class="stat-label">Sustainability</div>
                            <div class="stat-value">${product.sustainability}/100</div>
                        </div>
                    </div>
                    <div class="price">$${product.price}</div>
                    <button class="add-to-cart-btn" onclick="addToCart(${id})">
                        Add to Cart 🛒
                    </button>
                `;
    grid.appendChild(card);
  });
}

async function addToCart(productId) {
  try {
    const response = await fetch("/api/add-to-cart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ product_id: productId }),
    });

    const data = await response.json();

    if (data.success) {
      if (data.show_recommendation) {
        showRecommendation(data.recommendation);
      } else {
        showNotification(`${data.message} 💚`, "success");
        updateCoinBalance();
      }
      updateCartDisplay();
    } else {
      showNotification(data.error, "error");
    }
  } catch (error) {
    console.error("Error adding to cart:", error);
    showNotification("Error adding product to cart", "error");
  }
}

function showRecommendation(recommendation) {
  currentRecommendation = recommendation;
  const modal = document.getElementById("recommendationModal");
  document.getElementById("currentProductInfo").innerHTML = `
                <h4>${recommendation.current_product.name}</h4>
                <p>Price: $${recommendation.current_product.price}</p>
                <p>Carbon: ${recommendation.current_product.carbon}kg CO₂/year</p>
                <p>Sustainability: ${recommendation.current_product.sustainability}/100</p>
            `;
  document.getElementById("recommendedProductInfo").innerHTML = `
                <h4>${recommendation.suggested_product.name}</h4>
                <p>Price: $${recommendation.suggested_product.price}</p>
                <p>Carbon: ${
                  recommendation.suggested_product.carbon
                }kg CO₂/year</p>
                <p>Sustainability: ${
                  recommendation.suggested_product.sustainability
                }/100</p>
                <p style="color: #4CAF50; font-weight: bold;">
                    Save ${recommendation.carbon_savings}kg CO₂/year! 🌱
                </p>
                ${
                  recommendation.price_difference > 0
                    ? `<p style="color: #FF9800;">+$${recommendation.price_difference} more</p>`
                    : `<p style="color: #4CAF50;">Save $${Math.abs(
                        recommendation.price_difference
                      )}!</p>`
                }
            `;
  document.getElementById("aiComment").innerHTML = `
                🤖 AI Recommendation: ${recommendation.ai_comment}
            `;

  modal.style.display = "block";
}

async function acceptRecommendation() {
  if (!currentRecommendation) return;

  try {
    const response = await fetch("/api/accept-recommendation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from_id: currentRecommendation.current_id,
        to_id: currentRecommendation.suggested_id,
        carbon_savings: currentRecommendation.carbon_savings,
      }),
    });

    const data = await response.json();

    if (data.success) {
      showNotification(data.message, "success");
      updateCoinBalance();
      updateCartDisplay();
      closeRecommendation();
    } else {
      showNotification(data.error, "error");
    }
  } catch (error) {
    console.error("Error accepting recommendation:", error);
    showNotification("Error processing recommendation", "error");
  }
}

function closeRecommendation() {
  document.getElementById("recommendationModal").style.display = "none";
  currentRecommendation = null;
}

function toggleCart() {
  cartVisible = !cartVisible;
  document.getElementById("cartPanel").style.display = cartVisible
    ? "block"
    : "none";
  if (cartVisible) {
    updateCartDisplay();
  }
}

async function updateCartDisplay() {
  try {
    const response = await fetch("/api/get-cart");
    const data = await response.json();
    const totalItems = data.cart_items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
    document.getElementById("cartCount").textContent = totalItems;
    document.getElementById("coinBalance").textContent = data.eco_coins;
    const cartItemsDiv = document.getElementById("cartItems");
    cartItemsDiv.innerHTML = "";

    if (data.cart_items.length === 0) {
      cartItemsDiv.innerHTML =
        '<p style="text-align: center; color: #666;">Your cart is empty</p>';
    } else {
      data.cart_items.forEach((item) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "cart-item";
        itemDiv.innerHTML = `
                            <div>
                                <strong>${item.name}</strong><br>
                                <small>Qty: ${item.quantity} | ${item.carbon}kg CO₂ each</small>
                            </div>
                            <div>
                                <strong>$${item.total}</strong>
                            </div>
                        `;
        cartItemsDiv.appendChild(itemDiv);
      });
    }
    document.getElementById("cartSummary").innerHTML = `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span>Total Price:</span>
                        <strong>$${data.total_price}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span>Total Carbon Impact:</span>
                        <strong>${data.total_carbon}kg CO₂/year</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; color: #4CAF50;">
                        <span>Available EcoCoins:</span>
                        <strong>${data.eco_coins} coins</strong>
                    </div>
                `;
    document.getElementById("coinsToUse").max = data.eco_coins;
  } catch (error) {
    console.error("Error updating cart:", error);
  }
}

async function applyDiscount() {
  const coinsToUse = parseInt(document.getElementById("coinsToUse").value) || 0;

  if (coinsToUse <= 0) {
    showNotification("Please enter a valid number of coins", "error");
    return;
  }

  try {
    const response = await fetch("/api/apply-discount", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ coins: coinsToUse }),
    });

    const data = await response.json();

    if (data.success) {
      showNotification(data.message, "success");
      updateCartDisplay();
      document.getElementById("coinsToUse").value = "";
    } else {
      showNotification(data.error, "error");
    }
  } catch (error) {
    console.error("Error applying discount:", error);
    showNotification("Error applying discount", "error");
  }
}

async function checkout() {
  try {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (data.success) {
      if (data.environmental_impact.carbon_saved > 0) {
        const impactDiv = document.createElement("div");
        impactDiv.className = "environmental-impact";
        impactDiv.innerHTML = `
                            <h3>🌍 Your Environmental Impact</h3>
                            <div class="impact-stat">
                                <strong>${
                                  data.environmental_impact.carbon_saved
                                }kg</strong><br>
                                CO₂ Saved Annually
                            </div>
                            <div class="impact-stat">
                                <strong>${
                                  data.environmental_impact
                                    .eco_friendly_purchases
                                }</strong><br>
                                Eco-Friendly Purchases
                            </div>
                            <p>Equivalent to planting ${Math.floor(
                              data.environmental_impact.carbon_saved / 10
                            )} trees! 🌳</p>
                        `;
        document
          .getElementById("cartPanel")
          .insertBefore(
            impactDiv,
            document.getElementById("cartPanel").firstChild
          );
      }

      showNotification(data.message, "success");
      setTimeout(() => {
        updateCartDisplay();
        toggleCart();
      }, 3000);
    } else {
      showNotification(data.error, "error");
    }
  } catch (error) {
    console.error("Error during checkout:", error);
    showNotification("Error during checkout", "error");
  }
}

function updateCoinBalance() {
  setTimeout(updateCartDisplay, 500);
}

function showNotification(message, type = "success") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 4000);
}
window.onclick = function (event) {
  const modal = document.getElementById("recommendationModal");
  if (event.target === modal) {
    closeRecommendation();
  }
};
