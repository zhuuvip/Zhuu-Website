import axios from "axios";

const BASE_URL = "https://dripclientstore.shop/api/v1";

function token() {
  const value = process.env.DRIP_API_TOKEN;
  if (!value) throw new Error("DRIP_API_TOKEN belum diatur");
  return value;
}

export async function getDripProducts() {
  const { data } = await axios.get(`${BASE_URL}/products.php`, {
    headers: { "X-API-Token": token() },
    timeout: 10000,
  });
  return data;
}

export async function generateDripKey(variantId: number, quantity = 1) {
  const { data } = await axios.post(
    `${BASE_URL}/generate_key.php`,
    new URLSearchParams({
      variant_id: String(variantId),
      quantity: String(quantity),
    }),
    {
      headers: {
        "X-API-Token": token(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );
  return data;
}

export async function getDripBalance() {
  const { data } = await axios.get(`${BASE_URL}/balance.php`, {
    headers: { "X-API-Token": token() },
    timeout: 10000,
  });
  return data;
}
