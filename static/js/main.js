const PRODUCTS = {
  1: { name: "CoolAir 3000 (3★)", price: 300, carbon: 150, sustainability: 70 },
  2: { name: "EcoAir X (5★)", price: 400, carbon: 70, sustainability: 95 },
  3: { name: "PowerMax AC (2★)", price: 250, carbon: 200, sustainability: 40 },
  4: { name: "GreenBreeze Plus (4★)", price: 350, carbon: 90, sustainability: 85 },
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
    const cls = product.sustainability >= 80
      ? "high-sustainability"
      : product.sustainability >= 70
      ? "medium-sustainability"
      : "low-sustainability";

    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="sustainability-badge ${cls}">${product.sustainability}% Sustainable</div>
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
      <button class="add-to-cart-btn" onclick="addToCart(${id})">Add to Cart 🛒</button>
    `;
    grid.appendChild(card);
  });
}

async function addToCart(productId) {
  try {
    const res = await fetch("/api/add-to-cart", { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId }) });
    const data = await res.json();
    if (data.success) {
      if (data.show_recommendation) showRecommendation(data.recommendation);
      else showNotification(`${data.message} 💚`, 'success');
      updateCoinBalance();
      updateCartDisplay();
    } else showNotification(data.error, 'error');
  } catch (e) { console.error(e); showNotification('Error adding product to cart','error'); }
}


function showRecommendation(rec) {
  currentRecommendation = rec;
  document.getElementById('currentProductInfo').innerHTML = `
    <h4>${rec.current_product.name}</h4>
    <p>Price: $${rec.current_product.price}</p>
    <p>Carbon: ${rec.current_product.carbon}kg CO₂/year</p>
    <p>Sustainability: ${rec.current_product.sustainability}/100</p>
  `;
  document.getElementById('recommendedProductInfo').innerHTML = `
    <h4>${rec.suggested_product.name}</h4>
    <p>Price: $${rec.suggested_product.price}</p>
    <p>Carbon: ${rec.suggested_product.carbon}kg CO₂/year</p>
    <p>Sustainability: ${rec.suggested_product.sustainability}/100</p>
    <p style="color:#4CAF50;font-weight:bold;">Save ${rec.carbon_savings}kg CO₂/year! 🌱</p>
    ${ rec.price_difference>0
       ? `<p style="color:#FF9800;">+$${rec.price_difference} more</p>`
       : `<p style="color:#4CAF50;">Save $${Math.abs(rec.price_difference)}!</p>` }
  `;
  document.getElementById('aiComment').innerText = `🤖 AI Recommendation: ${rec.ai_comment}`;
  document.getElementById('recommendationModal').style.display = 'block';
}
async function acceptRecommendation() {
  if (!currentRecommendation) return;
  const res = await fetch('/api/accept-recommendation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from_id:currentRecommendation.current_id,to_id:currentRecommendation.suggested_id,carbon_savings:currentRecommendation.carbon_savings})});
  const d=await res.json();
  if(d.success){showNotification(d.message,'success'); updateCoinBalance(); updateCartDisplay(); closeRecommendation();}
  else showNotification(d.error,'error');
}
function closeRecommendation(){ document.getElementById('recommendationModal').style.display='none'; currentRecommendation=null; }


function toggleCart() {
  cartVisible = !cartVisible;
  const cartPanel = document.getElementById('cartPanel');
  
  if (cartVisible) {
    cartPanel.style.display = 'block'; 
    cartPanel.classList.add('active'); 
    updateCartDisplay();
  } else {
    cartPanel.classList.remove('active');
    setTimeout(() => {
      if (!cartVisible) {
        cartPanel.style.display = 'none';
      }
    }, 300); 
  }
}
async function updateCartDisplay(){
  try{
    const res=await fetch('/api/get-cart'); const d=await res.json();
    document.getElementById('cartCount').textContent = d.cart_items.reduce((s,i)=>s+i.quantity,0);
    document.getElementById('coinBalance').textContent = d.eco_coins;
    const div=document.getElementById('cartItems'); div.innerHTML='';
    if(d.cart_items.length===0) div.innerHTML='<p style="text-align:center;color:#666;">Your cart is empty</p>';
    else d.cart_items.forEach(item=>{ const it=document.createElement('div'); it.className='cart-item'; it.innerHTML=`<div><strong>${item.name}</strong><br><small>Qty: ${item.quantity} | ${item.carbon}kg CO₂ each</small></div><div><strong>$${item.total}</strong></div>`; div.appendChild(it); });
    document.getElementById('cartSummary').innerHTML = `<div style="display:flex;justify-content:space-between;margin-bottom:10px;"><span>Total Price:</span><strong>$${d.total_price}</strong></div><div style="display:flex;justify-content:space-between;margin-bottom:10px;"><span>Total Carbon Impact:</span><strong>${d.total_carbon}kg CO₂/year</strong></div><div style="display:flex;justify-content:space-between;color:#4CAF50;"><span>Available EcoCoins:</span><strong>${d.eco_coins} coins</strong></div>`;
    document.getElementById('coinsToUse').max = d.eco_coins;
  } catch(err){ console.error(err); }
}

async function applyDiscount(){
  const c=parseInt(document.getElementById('coinsToUse').value)||0;
  if(c<=0){showNotification('Please enter a valid number of coins','error');return;}
  const res=await fetch('/api/apply-discount',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({coins:c})}); const d=await res.json();
  if(d.success){showNotification(d.message,'success'); updateCartDisplay(); document.getElementById('coinsToUse').value='';}
  else showNotification(d.error,'error');
}
async function checkout(){
  try{ const res=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'}}); const d=await res.json();
    if(d.success){
      if(d.environmental_impact.carbon_saved>0){
        const impact=document.createElement('div'); impact.className='environmental-impact'; impact.innerHTML=`<h3>🌍 Your Environmental Impact</h3><div class="impact-stat"><strong>${d.environmental_impact.carbon_saved}kg</strong><br>CO₂ Saved Annually</div><div class="impact-stat"><strong>${d.environmental_impact.eco_friendly_purchases}</strong><br>Eco-Friendly Purchases</div><p>Equivalent to planting ${Math.floor(d.environmental_impact.carbon_saved/10)} trees! 🌳</p>`;
        document.getElementById('cartPanel').insertBefore(impact,document.getElementById('cartPanel').firstChild);
      }
      showNotification(d.message,'success'); setTimeout(()=>{updateCartDisplay(); toggleCart();},3000);
    } else showNotification(d.error,'error');
  } catch(e){console.error(e); showNotification('Error during checkout','error');}
}
function updateCoinBalance(){ setTimeout(updateCartDisplay,500); }
function showNotification(msg,type='success'){ const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg; document.body.appendChild(n); setTimeout(()=>n.remove(),4000); }

window.onclick = function(event) {
  const recModal = document.getElementById('recommendationModal');
  if (event.target === recModal) closeRecommendation();
  const asmModal = document.getElementById('assessmentModal');
  if (event.target === asmModal) closeAssessment();
};
const assessmentModal = document.getElementById('assessmentModal');
const assessmentForm = document.getElementById('assessmentForm');
const assessmentResult = document.getElementById('assessmentResult');

function openAssessment() {
  assessmentForm.reset();
  assessmentResult.innerHTML = '';
  assessmentModal.style.display = 'block';
}

function closeAssessment() {
  assessmentModal.style.display = 'none';
}

assessmentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  assessmentResult.innerHTML = '⏳ Assessing...';
  const payload = {
    name: document.getElementById('prodName').value,
    year: document.getElementById('purchaseYear').value,
    power_draw: document.getElementById('powerDraw').value,
    condition: document.getElementById('condition').value,
    rating: document.getElementById('rating').value,
  };
  try {
    const res = await fetch('/api/assess-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Assessment failed');
    
    let result;
    try {
      let cleanResult = data.result;
      if (cleanResult.includes('```json')) {
        cleanResult = cleanResult.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      }
      result = JSON.parse(cleanResult);
    } catch (parseError) {
      console.error('Parse error:', parseError);
      throw new Error('Invalid response format from server');
    }
    const score = result.eco_score || result.score || 0;
    const coins = result.eco_coins || result.coins || 0;
    const reason = result.rationale || result.reason || 'No reason provided';
    
    assessmentResult.innerHTML = `
      <p><strong>Eco-Score:</strong> ${score}/100</p>
      <p><strong>Coin Offer:</strong> ${coins} EcoCoins</p>
      <p><em>${reason}</em></p>
      <button class="btn btn-success" onclick="confirmSwap(${coins})">
        Accept & Credit Coins
      </button>
    `;
  } catch (err) {
    console.error('Assessment error:', err);
    assessmentResult.innerHTML = `<p style="color:red;">⚠️ ${err.message}</p>`;
  }
});

async function confirmSwap(coins) {
  const res = await fetch('/api/credit-coins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ coins }) });
  const d = await res.json();
  if (res.ok) {
    document.getElementById('coinBalance').innerText = d.new_balance;
    closeAssessment();
  } else alert(d.error || 'Failed to credit coins');
}