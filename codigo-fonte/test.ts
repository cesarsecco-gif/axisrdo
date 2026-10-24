import { createXlsx } from './xlsxWriter';
import fs from 'fs';

try {
  const headers = ['Equipamento', '1', '2'];
  const rows = [
    ['ESCAVADEIRA', '1', null],
    ['TRATOR', null, '2'],
    ['TOTAL EM USO', '1', '2']
  ];
  const qtyHeaders = ['Equipamento', 'Quantidade Atual'];
  const qtyRows = [
    ['ESCAVADEIRA', '0'],
    ['TRATOR', '2'],
    ['TOTAL', '2']
  ];

  const bytes = createXlsx([
    { name: 'Equipamentos', headers, rows },
    { name: 'Quantidades Atuais', headers: qtyHeaders, rows: qtyRows }
  ]);
  
  fs.writeFileSync('test.xlsx', bytes);
  console.log('SUCCESS');
} catch (e) {
  console.error('ERROR:', e);
}
