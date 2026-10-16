import axios from 'axios';

async function testar() {
  const mirrors = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass-api.de/api/interpreter'
  ];

  const query = `
    [out:json][timeout:15];
    (
      node["amenity"="pharmacy"](-16.75,-49.35,-16.60,-49.20);
    );
    out 10 tags;
  `;

  for (const mirror of mirrors) {
    try {
      console.log(`Testando ${mirror}...`);
      const res = await axios.post(mirror, query, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 10000
      });
      console.log(`✅ Sucesso no mirror: ${mirror}!`);
      console.log(`Encontrados: ${res.data.elements.length} registros`);
      res.data.elements.slice(0, 5).forEach(e => {
        console.log(`- ${e.tags.name || 'Sem nome'} | ${e.tags['addr:street'] || 'S/ rua'} | Tel: ${e.tags.phone || e.tags['contact:phone'] || 'N/A'}`);
      });
      return;
    } catch (err) {
      console.log(`❌ Falha no mirror ${mirror}: ${err.message}`);
    }
  }
}

testar();
