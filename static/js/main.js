document.addEventListener("DOMContentLoaded", () => {
  const checkoutBtn = document.getElementById("checkout");
  if (!checkoutBtn) return;

  checkoutBtn.addEventListener("click", async () => {
    const lis = document.querySelectorAll("#cart-list li");
    const items = Array.from(lis).map(li => {
      const text = li.textContent;
      const [left, right] = text.split("—");
      const [name, qtyPart] = left.trim().split("×");
      const qty = parseInt(qtyPart);
      let id = name.includes("CoolAir") ? 1 : 2;
      return { id, qty };
    });
    const res = await fetch("/api/eco-score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    });
    const { eco_score, recommendations, coins } = await res.json();
    document.getElementById("eco-score").textContent = eco_score;
    document.getElementById("coins-total").textContent = coins;
    const ul = document.getElementById("swap-list");
    ul.innerHTML = "";
    recommendations.forEach(r => {
      const li = document.createElement("li");
      li.innerHTML = `
        Swap “${r.from_name}” → “${r.to_name}”: Save ${r.impact_diff} kg → Earn ${r.coins} coins
        <button class="why-btn" data-from="${r.from_id}" data-to="${r.to_id}">Why?</button>
      `;
      ul.append(li);
    });

    document.getElementById("eco-modal").classList.remove("hidden");
  });
  document.getElementById("eco-modal").addEventListener("click", async e => {
    if (e.target.id === "close-modal") {
      e.currentTarget.classList.add("hidden");
    }
    if (e.target.classList.contains("why-btn")) {
      const from = e.target.dataset.from;
      const to = e.target.dataset.to;
      const resp = await fetch("/api/ai-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_id: from, to_id: to })
      });
      const { comment } = await resp.json();
      alert(comment);
    }
    if (e.target.id === "apply-redemption") {
      const num = prompt("Enter coins to redeem:");
      const amt = parseInt(num);
      const r = await fetch("/api/redeem-coins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coins: amt })
      });
      if (r.ok) {
        const { balance } = await r.json();
        alert(`Redeemed! New balance: ${balance} coins`);
      } else {
        const err = await r.json();
        alert(err.error);
      }
    }
  });
});