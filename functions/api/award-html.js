export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = (url.searchParams.get("code") || "").toUpperCase();

  if (!/^MA\d{6}$/.test(code)) {
    return new Response("Invalid award code", { status: 400 });
  }

  const awardUrl = `https://awards.fairwork.gov.au/${code}.html`;
  const response = await fetch(awardUrl);
  const html = await response.text();

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
}
