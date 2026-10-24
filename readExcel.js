const xlsx = require('xlsx');
const wb = xlsx.readFile('D:\\ANTIGRAVITY\\SIS RDO\\Relatorio-DER-PR\\modelo\\modelos para implementação.xlsx');
wb.SheetNames.forEach(name => {
    console.log('--- Sheet:', name, '---');
    console.log(xlsx.utils.sheet_to_json(wb.Sheets[name]).slice(0, 10));
});
