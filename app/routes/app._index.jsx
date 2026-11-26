import { useState } from 'react';
import { authenticate } from '../shopify.server';

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return { ok: true };
};

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const body = await request.json();
    const title = body.title || 'Sample Product';
    const features = body.features || '';
    const language = body.language || 'Arabic';
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
    const rawText = aiData.choices && aiData.choices[0] && aiData.choices[0].message ? aiData.choices[0].message.content : '{}';
    const parsed = JSON.parse(rawText);
    await admin.graphql('#graphql\n mutation createAIProduct($product: ProductCreateInput!) { productCreate(product: $product) { product { id } } }', {
      variables: { product: { title, descriptionHtml: parsed.descriptionHtml || '', tags: parsed.tags || [], seo: { title: parsed.seoTitle || title } } }
    });
    return Response.json({ aiResult: parsed });
  } catch (err) {
    return Response.json({ error: String(err.message || err) }, { status: 200 });
  }
};

export default function Index() {
  const [title, setTitle] = useState('Smart Watch Pro');
  const [features, setFeatures] = useState('Waterproof, Heart rate monitor, 7-day battery');
  const [language, setLanguage] = useState('Arabic');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, features, language })
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResult(data.aiResult);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <s-page heading='Ecom Expand AI - Store Assistant'>
      <s-section heading='AI_Product_Suite (Pro Active)'>
        <s-stack direction='block' gap='base'>
          <s-text-field label='Product Name' value={title} onInput={(e) => setTitle(e.target.value)}></s-text-field>
          <s-text-field label='Key Features' value={features} onInput={(e) => setFeatures(e.target.value)}></s-text-field>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}>
            <option value='Arabic'>Arabic</option>
            <option value='English'>English</option>
            <option value='French'>French</option>
            <option value='Spanish'>Spanish</option>
            <option value='German'>German</option>
            <option value='Turkish'>Turkish</option>
          </select>
          <s-button variant='primary' onClick={handleGenerate} {...(loading ? { loading: true } : {})}>
            Generate Full Product (Description + SEO + Tags + Price)
          </s-button>
          {error && <s-box padding='base' background='critical'><p style={{ color: 'red' }}>{error}</p></s-box>}
          {result && (
            <s-section heading='Generated AI Content'>
              <s-box padding='base' borderWidth='base' background='subdued'>
                <p><strong>SEO Title:</strong> {result.seoTitle}</p>
                <p><strong>Suggested Price:</strong> {result.suggestedPrice}</p>
                <p><strong>Tags:</strong> {(result.tags || []).join(', ')}</p>
                <hr />
                <div dangerouslySetInnerHTML={{ __html: result.descriptionHtml }} />
              </s-box>
            </s-section>
          )}
        </s-stack>
      </s-section>
    </s-page>
  );
}
