import { UPSTREAMS, proxySparql } from './_lib/proxy.js'

export const config = {
  maxDuration: 30,
}

/** Proxied SPARQL — destination for /sparql/:source rewrites. */
export default async function handler(req, res) {
  const raw = req.query?.source
  const source = (Array.isArray(raw) ? raw[0] : raw) || 'wikidata'
  const upstream = UPSTREAMS[source] || UPSTREAMS.wikidata
  await proxySparql(upstream, req, res)
}
