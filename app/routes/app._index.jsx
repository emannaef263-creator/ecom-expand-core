import { useState, useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate, PRO_PLAN } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request); return { isPro: true };
};

export const action = async ({ request }) => {
  const { admin, billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "subscribe") {
    const result = await billing.request({
      plan: PRO_PLAN,
      isTest: true,
    });
    return { confirmationUrl: result.confirmationUrl };
  }

  const title = formData.get("title") || "Smart Watch";
  const features = formData.get("features") || "Waterproof, 7-day battery";
  const language = formData.get("language") || "Arabic";

  const prompt = `You are an e-commerce expert. Generate a JSON object for a product named "${title}" with features: ${features} in ${language} language. The JSON MUST have exactly these 4 keys: "descriptionHtml" (HTML formatted with <p>,<ul>,<li>,<strong>), "seoTitle" (max 60 chars), "tags" (array of 5 short tags), and "suggestedPrice" (number in USD like 49.99). Return ONLY valid JSON.`;

  const aiResponse = await fetch("https://groq.com", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" }
    })
  });

  const aiData = await aiResponse.json();
  let parsed = { descriptionHtml: "", seoTitle: title, tags: [], suggestedPrice: "29.99" };
  try {
    parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
  } catch (e) {}

  const response = await admin.graphql(
    `#graphql
    mutation createAIProduct($product: ProductCreateInput!) {
      productCreate(product: $product) {
        product { id title variants(first:1) { edges { node { id } } } }
      }
    }`,
    {
      variables: {
        product: {
          title,
          descriptionHtml: parsed.descriptionHtml,
          tags: parsed.tags || [],
          seo: { title: parsed.seoTitle || title }
        }
      }
    }
  );
  const responseJson = await response.json();
  const createdProduct = responseJson.data?.productCreate?.product;
  const variantId = createdProduct?.variants?.edges?.[0]?.node?.id;

  if (createdProduct?.id && variantId) {
    await admin.graphql(
      `#graphql
      mutation updatePrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants { id }
        }
      }`,
      {
        variables: {
          productId: createdProduct.id,
          variants: [{ id: variantId, price: String(parsed.suggestedPrice || "29.99") }]
        }
      }
    );
  }

  return { product: createdProduct, aiResult: parsed };
};

export default function Index() {
  const { isPro } = useLoaderData();
  const fetcher = useFetcher();
  const [title, setTitle] = useState("");
  const [features, setFeatures] = useState("");
  const [language, setLanguage] = useState("Arabic");
  const isLoading = ["loading", "submitting"].includes(fetcher.state);

  useEffect(() => {
    if (fetcher.data?.confirmationUrl) {
      window.open(fetcher.data.confirmationUrl, "_top");
    }
  }, [fetcher.data]);

  return (
    <s-page heading="Ecom Expand AI - Store Assistant">
      {!isPro ? (
        <s-section heading="Upgrade to Pro Plan">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="base">
              <p><strong>Pro Monthly Plan - $19.99/month</strong> (7-day Free Trial)</p>
              <p>Unlock unlimited AI Product Descriptions, SEO Titles, Smart Tags, and Auto-Pricing in 6 languages.</p>
              <s-button onClick={() => fetcher.submit({ intent: "subscribe" }, { method: "POST" })} {...(isLoading ? { loading: true } : {})}>
                Start 7-Day Free Trial ($19.99/mo)
              </s-button>
            </s-stack>
          </s-box>
        </s-section>
      ) : (
        <s-section heading="AI_Product_Suite (Pro Active)">
          <s-stack direction="block" gap="base">
            <s-text-field label="Product Name" value={title} onInput={(e) => setTitle(e.target.value)} placeholder="Smart Watch" />
            <s-text-field label="Key Features" value={features} onInput={(e) => setFeatures(e.target.value)} placeholder="Waterproof, 7-day battery" />
            <label style={{ fontWeight: "bold", marginTop: "8px" }}>Language:</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ padding: "8px", borderRadius: "6px", borderColor: "#ccc" }}>
              <option value="Arabic">Arabic</option>
              <option value="English">English</option>
              <option value="French">French</option>
              <option value="Spanish">Spanish</option>
              <option value="German">German</option>
              <option value="Turkish">Turkish</option>
            </select>
            <s-button onClick={() => fetcher.submit({ title, features, language }, { method: "POST" })} {...(isLoading ? { loading: true } : {})}>
              Generate Full Product (Description + SEO + Tags + Price)
            </s-button>
          </s-stack>
          {fetcher.data?.aiResult && (
            <s-section heading="Generated AI Content">
              <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
                <p><strong>SEO Title:</strong> {fetcher.data.aiResult.seoTitle}</p>
                <p><strong>Suggested Price:</strong> ${fetcher.data.aiResult.suggestedPrice}</p>
                <p><strong>Tags:</strong> {(fetcher.data.aiResult.tags || []).join(", ")}</p>
                <hr />
                <div dangerouslySetInnerHTML={{ __html: fetcher.data.aiResult.descriptionHtml }} />
              </s-box>
            </s-section>
          )}
        </s-section>
      )}
    </s-page>
  );
}

