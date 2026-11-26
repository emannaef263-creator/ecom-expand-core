import { useState } from 'react';
import { useFetcher } from 'react-router';
import { authenticate } from '../shopify.server';
export const loader = async ({ request }) => {
 const { admin } = await authenticate.admin(request);
 const url = new URL(request.url);
 const title = url.searchParams.get('title');
 if (!title) return null;
 const features = url.searchParams.get('features') || '';
 const language = url.searchParams.get('language') || 'Arabic';
 const aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
 method: 'POST',
 headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY, 'Content-Type': 'application/json' },
 body: JSON.stringify({
 model: 'llama-3.3-70b-versatile',
 messages: [{ role: 'user', content: 'Return ONLY valid JSON with keys descriptionHtml, seoTitle, tags (array), suggestedPrice (string) in ' + language + ' for product: ' + title + '. Features: ' + features }],
 response_format: { type: 'json_object' }
 })
 });
 const aiData = await aiResponse.json();
 let parsed = { descriptionHtml: '', seoTitle: title, tags: [], suggestedPrice: '29.99' };
 try { parsed = JSON.parse(aiData.choices?.[0]?.message?.content || '{}'); } catch (e) {}
 await admin.graphql('#graphql\n mutation createAIProduct($product: ProductCreateInput!) { productCreate(product: $product) { product { id } } }', {
 variables: { product: { title, descriptionHtml: parsed.descriptionHtml, tags: parsed.tags || [], seo: { title: parsed.seoTitle || title } } }
 });
 return { aiResult: parsed };
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
              <s-button onClick={() => fetcher.submit({ intent: "subscribe" }, { method: "GET" })} {...(isLoading ? { loading: true } : {})}>
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
            <s-button onClick={() => fetcher.submit({ title, features, language }, { method: "GET" })} {...(isLoading ? { loading: true } : {})}>
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


