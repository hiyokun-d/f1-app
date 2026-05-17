// Maps circuit_short_name / location strings → /tracks/<slug>.svg
// Matching is case-insensitive substring on the combined "shortName location" string.
const CIRCUIT_ENTRIES: [string, string][] = [
  ['albert park',        'albert-park'],
  ['monza',              'monza'],
  ['bahrain',            'bahrain'],
  ['sakhir',             'bahrain'],
  ['catalunya',          'catalunya'],
  ['barcelona',          'catalunya'],
  ['imola',              'imola'],
  ['baku',               'baku'],
  ['gilles villeneuve',  'gilles-villeneuve'],
  ['montreal',           'gilles-villeneuve'],
  ['montréal',           'gilles-villeneuve'],
  ['hermanos rodriguez', 'hermanos-rodriguez'],
  ['mexico',             'hermanos-rodriguez'],
  ['hungaroring',        'hungaroring'],
  ['budapest',           'hungaroring'],
  ['jose carlos pace',   'jose-carlos-pace'],
  ['interlagos',         'jose-carlos-pace'],
  ['são paulo',          'jose-carlos-pace'],
  ['sao paulo',          'jose-carlos-pace'],
  ['las vegas',          'las-vegas'],
  ['marina bay',         'marina-bay'],
  ['singapore',          'marina-bay'],
  ['miami',              'miami'],
  ['monaco',             'monaco'],
  ['americas',           'americas'],
  ['austin',             'americas'],
  ['red bull ring',      'red-bull-ring'],
  ['spielberg',          'red-bull-ring'],
  ['shanghai',           'shanghai'],
  ['silverstone',        'silverstone'],
  ['spa',                'spa'],
  ['francorchamps',      'spa'],
  ['suzuka',             'suzuka'],
  ['yas marina',         'yas-marina'],
  ['abu dhabi',          'yas-marina'],
  ['zandvoort',          'zandvoort'],
  ['jeddah',             'jeddah'],
  ['lusail',             'lusail'],
  ['qatar',              'lusail'],
]

export function getCircuitSvgUrl(
  circuitShortName: string,
  location: string,
): string | null {
  const haystack = `${circuitShortName} ${location}`.toLowerCase()
  for (const [key, slug] of CIRCUIT_ENTRIES) {
    if (haystack.includes(key)) return `/tracks/${slug}.svg`
  }
  return null
}
