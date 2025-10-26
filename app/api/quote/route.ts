import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Pricing function (tweak as needed)
function priceQuote(area: number, bucket: "Light"|"Medium"|"Heavy") {
  const base = 25;
  const per = bucket === "Light" ? 2.0 : bucket === "Medium" ? 3.0 : 4.5;
  const disc = area > 60 ? 0.90 : 1.00;
  const minJob = 80;
  const raw = (base + area * per) * disc;
  return Math.max(minJob, Math.round(raw));
}

export async function POST(req: NextRequest) {
  try {
    const { image_urls, scale_meters = null, polygon_area_m2 = null, currency = 'EUR' } = await req.json();
    if (!Array.isArray(image_urls) || image_urls.length === 0) return NextResponse.json({ error: 'image_urls required' }, { status: 400 });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const systemText = (
      "You are a property-services estimator. " +
      "Infer patio AREA (m²) and CLEANLINESS from images. " +
      "If polygon_area_m2 is provided, prefer it and sanity-check against images. " +
      "Else use scale_meters and visible cues (paver grid, edges). " +
      "Cleanliness: Light (dust/light film), Medium (visible grime/some moss), Heavy (dark staining, algae/moss/oil). " +
      "Be conservative: return a low/high range if uncertain. Numeric fields must be numbers."
    );

    const tools: any = [
      { type: 'function', function: {
          name: 'return_quote_inputs',
          description: 'Return patio area and cleanliness from images.',
          parameters: {
            type: 'object',
            properties: {
              areaGuess_m2: { type: 'number' },
              areaLow_m2: { type: 'number' },
              areaHigh_m2: { type: 'number' },
              cleanliness: { type: 'string', enum: ['Light','Medium','Heavy'] },
              confidence: { type: 'number' },
              notes: { type: 'string' }
            },
            required: ['areaGuess_m2','areaLow_m2','areaHigh_m2','cleanliness','confidence','notes'],
            additionalProperties: false
          },
          strict: true
      }}
    ];

    const meta = { scale_meters, polygon_area_m2 };
    const userContent: any[] = [{ type: 'text', text: JSON.stringify(meta) }];
    userContent.push(...image_urls.map((u: string) => ({ type: 'image_url', image_url: { url: u } })));

    const resp = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemText },
        { role: 'user', content: userContent }
      ],
      tools,
      tool_choice: { type: 'function', function: { name: 'return_quote_inputs' } }
    });

    const toolCall = resp.choices[0].message.tool_calls?.[0];
    if (!toolCall) return NextResponse.json({ error: 'model returned no tool output' }, { status: 500 });

    const data = JSON.parse(toolCall.function.arguments);
    const areaForPrice = polygon_area_m2 ?? data.areaGuess_m2;
    const price = priceQuote(areaForPrice, data.cleanliness);

    return NextResponse.json({ inputs: { image_urls, scale_meters, polygon_area_m2, currency }, model: data, price, currency });

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'unknown error' }, { status: 500 });
  }
}
